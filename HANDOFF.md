# Handoff doc — The League (daleague/daleague.github.io)

Purpose: pick up this work in a fresh session (any assistant — GPT, Claude, Grok) without
re-deriving context. Update this file as you complete steps; keep entries dated and specific.
Newest entries at the top.

---

## 2026-09-27 — Fix Biggest Upset for completed Yahoo snapshots

### Validation
The latest successful production Pages artifact (workflow run 36359945202, generated September 27, 2026) was inspected directly. Weeks 1 and 2 had winProbability values of exactly 0%/100% on every completed matchup, even though projected scores still contained pregame expectations. Those terminal probabilities explain why the existing Biggest Upset logic produced no award: it only accepts winners below 50%, and the postgame snapshot turns the winning side into 100% and the losing side into 0%.

For the same artifact:
- Week 1 had one projected-score underdog who won: Team 2, projected 113.8 vs Team 11 at 115.2 (about a 1.4-point deficit).
- Week 2 had no projected-score underdog winners.

Therefore an empty Biggest Upset section was not evidence that there had been no upset; it was a data-contract issue in the historical snapshot.

### Fix
- scripts/transform/parse.ts: Biggest Upset now uses strict interior Yahoo win probabilities (0 < probability < 100) when they are available and below 50%.
- Terminal 0%/100% probabilities from completed snapshots are treated as unusable pregame odds.
- When no usable pregame probability exists, the calculation falls back to the largest positive projected-score deficit among the week's winners.
- The award description/value identify which source was used.
- scripts/transform/parse.test.ts: added coverage for the 0%/100% historical-snapshot case.

### Commit
This section is recorded in the same commit as the code/test changes so the handoff is recoverable from the repository history.

---
## 2026-09-27 — Session: player-points bug + superlative audit

### Reported symptom
After a player scores points for their team, the points show up in the team's overall
score, but the individual player's points don't show in the roster view.

### Root cause (found via code review, not yet confirmed against a live fetch — see "Still needs
live verification" below)

`scripts/yahoo/client.ts` fetches rosters+stats for a week in two stages:

1. Bulk, all-teams-at-once:
   `/league/{league_key}/teams/roster;week=N/players/stats;type=week;week=N`
2. If that call *throws*, per-team fallback:
   `/team/{team_key}/roster;week=N/players/stats;type=week;week=N`, and if *that* throws,
   `/team/{team_key}/roster;week=N` (no stats sub-resource at all).

The bug: Yahoo's API has a known quirk where chaining `stats` three collection-levels deep
(`teams` → `roster` → `players` → `stats`) can return **HTTP 200 with every player present,
but the `player_points` sub-resource silently missing** from each player node. That is not an
exception — `yahooJson()` never throws — so the code accepted the response as-is and cached a
roster where every player effectively has 0 points, while team-level scores (which come from
the separate, independent `/scoreboard` endpoint via `team_points`) were correct the whole time.
That exactly matches the reported symptom: team score right, individual player rows wrong.

### Fix applied

- `scripts/yahoo/yahooJson.ts`: added `hasResolvableTotal(record, key)` — checks whether a key
  (e.g. `player_points`) resolves to an actual total anywhere in the record, vs. being
  structurally absent. This is the tool for telling "real (possibly legitimate) zero" apart from
  "field never came through."
- `scripts/yahoo/client.ts`: after the bulk roster+stats fetch succeeds at the HTTP level, we now
  also check that at least one player in the response has a resolvable `player_points` total. If
  not, we treat it as a failed fetch and fall through to the per-team loop (same as an actual
  HTTP error). The per-team loop's own no-stats fallback (`/team/{team_key}/roster;week=N`) is
  kept as a last resort (better an incomplete roster — names/slots — than no roster at all), but
  now logs a loud `console.warn` when it's used, so a future zero-points regression shows up in
  CI logs instead of only as a silent UI discrepancy.
- Added a unit test for `hasResolvableTotal` in `scripts/yahoo/yahooJson.test.ts`.

### Still needs live verification

This fix was derived entirely from static code review — the attached `yahoo_debug_data.json`
debug pull was **not usable for confirming it**: all four endpoints in that file
(`scoreboard`, `teams`, `all_team_rosters`, `league_settings`) returned HTTP 403
`"You are not allowed to view this page because you are not in this league."` for league
`461.l.344338`. That's a blanket auth/league-mismatch failure on every endpoint, not evidence
about the roster/points code path specifically — it most likely means the token used to pull
that debug file either doesn't belong to a member of that league, or the league key doesn't match
the account behind the token/refresh token that generated it.

Before trusting this fix in production:
1. Get a **valid** bearer token/refresh token that Yahoo actually authorizes for league
   `461.l.344338` (or confirm the correct league key for the account being used).
2. Re-pull `/league/{league_key}/teams/roster;week=N/players/stats;type=week;week=N` directly and
   check whether `player_points` is present per player. If Yahoo doesn't reproduce the silent-miss
   quirk for this league/week, the fix is still safe (it's a no-op when the bulk fetch already
   contains points) — but it means the actual bug may be elsewhere and needs a second look with
   real data.
3. **Do not paste the bearer token into chat/committed files.** It should be set as the
   `YAHOO_REFRESH_TOKEN` / `YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET` GitHub Actions **secrets**
   (see README → "Connecting Yahoo Fantasy"), or exported as a local env var only, never
   committed. If a token was shared anywhere insecurely, rotate it.

### Superlative calculations — audit results

Reviewed all of `makeSuperlatives` and `findDonkey` in `scripts/transform/parse.ts` against the
existing test suite plus git history. Findings:

- **Confirmed bug (fixed):** `scripts/transform/parse.test.ts` had a stale assertion —
  `expect(byTitle["Brick Wall"].teamId).toBe("4")` — left over from commit `90cdd25` ("Remove
  defensive Brick Wall superlative"), which deleted the Brick Wall award but not the test
  assertion for it. This was a real failing test (`npx vitest run` failed before this session's
  fix). Updated the test to assert `Brick Wall` is no longer awarded.
- **Dead code (cleaned up, not a behavior bug):** the "Dumpster Fire of the Week" award had an
  `if / else if` where the `else if` branch could never execute (it re-checked
  `lowest.side.score < highest.side.score` for the *same* team object after the `if` branch
  already excluded the case where they're different teams — the only way to reach the `else if`
  is `lowest.side.teamId === highest.side.teamId`, at which point `lowest.side.score <
  highest.side.score` is comparing a value to itself and is always false). Simplified to a single
  condition; behavior is unchanged, just clearer and the "always-false" branch is gone.
- **Everything else checked out:** Team of the Week, Pain of the Week, Biggest Upset, Biggest
  Choke, Ice Cold, Statement Win, Explosion, Trending Up/Down, and Donkey of the Week all matched
  their descriptions and passed a manual trace against the test fixtures. `findDonkey`'s
  `eligibleStarterSlots` correctly handles QB/RB/WR/TE/DEF/K plus both `FLEX` and `W/R/T` flex
  slot spellings (commit `091c0a0`, same session before this one, already covers this).

### Known limitation flagged, not fixed (needs league settings to know if it applies)

`eligibleStarterSlots` in `scripts/transform/parse.ts` does not include a superflex slot
(commonly `Q/W/R/T`) or a no-RB flex (`W/T`). If this league uses a superflex or similar
non-standard flex slot, a bench QB that should be Donkey-eligible against that slot won't be
detected. Confirming this requires the league's roster/position settings
(`/league/{league_key}/settings`), which is one of the four endpoints that 403'd in the attached
debug file — so this couldn't be confirmed either way this session. Worth checking once
credentials are sorted out; grep for `eligibleStarterSlots` if picking this up.

### Repo / access notes for next session

- No GitHub MCP connector was available in this environment (checked via connector registry
  search — nothing matched "github", "git", "repository", "pull request", "commit", "push").
  There was also no `gh` CLI, no git credential helper, and no `GITHUB_TOKEN`/SSH key in the
  sandbox. **Pushing these commits required asking the user for a personal access token**,
  used only transiently for `git push` over HTTPS in that session's sandbox — it was not
  stored anywhere. If continuing this work in a fresh sandbox, expect to need the same thing
  again unless a GitHub connector becomes available.
- The repo's `data/current/*.json` files are **not** committed to git — the deploy workflow
  (`.github/workflows/deploy.yml`) generates them fresh on every run and copies them straight
  into the Pages build artifact; they never land in git history. So you can't inspect
  "what did production actually generate" by looking at the repo — you have to re-run
  `npm run fetch:yahoo && npm run generate` with real, working credentials, or add temporary
  logging to the Action.
- README.md's "Status: Phase 1" framing is stale — Yahoo ingestion (`scripts/yahoo/`),
  transform (`scripts/transform/`), and the superlatives engine are all implemented and running
  in production per the deploy workflow and 60+ commits of history. Worth a README refresh at
  some point, but out of scope for this session.

### Commands used this session

```bash
npm install
npx vitest run     # 14/14 passing after fixes
npx tsc -b          # clean
```
