# The League

A public, static fantasy football command center backed by Yahoo Fantasy Sports data — current-week
dashboard, weekly history, box scores, standings, superlatives, power rankings, luck, and a league
record book, all served as a static site on GitHub Pages.

**Status: Phase 1 of the build.** The frontend, design system, and data contracts are in place and
running against realistic mock data. Yahoo ingestion, GitHub Actions automation, and the
calculation-heavy pages (Power Rankings, Record Book, historical snapshots) are stubbed with honest
"coming soon" states rather than fabricated numbers — see [Roadmap](#roadmap).

## What's here right now

- Current-week dashboard with a live score ticker and scoreboard-style matchup cards
- Matchup detail / box score pages with full starter-by-starter scoring
- League standings with playoff-status indicators
- Team pages (current record/rank; season timeline arrives with historical snapshots)
- Yahoo-style manager profiles and matchup manager comparisons, backed by mock data for now
- A weekly superlatives engine's *output* — the actual weekly calculation engine is a Phase 2 item,
  but the data shape and UI are real
- A mock-data mode so the entire UI can be built and reviewed without ever touching Yahoo's API
- The full domain type system (`src/types/league.ts`) that ingestion, derived stats, and the frontend
  will all share

## Architecture

```
Yahoo Fantasy API
      |
      v
GitHub Actions  ──►  scripts/yahoo/*     (auth + fetch — Phase 2)
      |         ──►  scripts/transform/* (normalize + derive stats — Phase 2)
      |         ──►  data/current/*.json, data/historical/*.json
      v
GitHub Pages  ◄──  static frontend reads only the generated JSON above
```

The browser never talks to Yahoo and never sees Yahoo credentials. It only fetches static JSON —
either the mock files in `public/data/mock/` (local dev) or the generated files in `data/current/`
(production build). See `src/data/dataSource.ts`.

Teams are identified everywhere by **stable Yahoo team ID**, never by name — see
`src/types/league.ts`. Names/icons can change; the ID cannot.

Manager profile data is kept in its own `manager-profiles.json` dataset and joined to a team through
`managerId`. This deliberately keeps the frontend independent of Yahoo's eventual source shape. The
Yahoo ingestion layer only needs to emit the same normalized `ManagerProfile` contract.

```
.github/workflows/     CI (data refresh + Pages deploy) — Phase 2
scripts/
  yahoo/                Yahoo OAuth + API fetchers — Phase 2 (stubbed entry point today)
  transform/             Normalization + derived stats — Phase 2 (stubbed entry point today)
data/
  current/               Generated JSON consumed by the production build (empty for now)
  historical/             Immutable per-week snapshots (empty for now)
src/
  types/league.ts        Shared domain types, including ManagerProfile
  data/dataSource.ts      Mock-vs-production data switch + manager-profile feature flag
  hooks/useLeagueData.ts  Loads + bundles league data for the app
  components/             TeamBadge, ManagerProfile, ScoreTicker, MatchupCard, WeekSelector, SuperlativeCard, Layout
  pages/                  Dashboard, Standings, MatchupDetail, TeamPage, PowerRankings, RecordBook
public/data/mock/         Hand-authored realistic mock JSON, including manager-profiles.json
```

## Local development

```bash
npm install
npm run dev       # http://localhost:5173, runs entirely on mock data
npm run build     # type-check + production build
npm run preview   # preview the production build locally
```

No Yahoo account or credentials are needed for any of the above — `VITE_USE_MOCK_DATA` defaults to
`true`, and the app reads from `public/data/mock/`.

Manager profiles are enabled by default. Set `VITE_ENABLE_MANAGER_PROFILES=false` in `.env` to hide
the UI locally.

`npm run fetch:yahoo` and `npm run generate` are wired up as commands but are placeholder stubs right
now; they print a clear message and exit rather than fail confusingly. They'll become real in Phase 2.

## Mock data

Everything under `public/data/mock/` is fabricated: 8 teams, a Week 3 with two live and two final
matchups, full starter-by-starter scoring, standings through Week 2, a set of Week 3 superlatives, and
manager profile histories. `league.json` carries `"isMockData": true`, which the UI surfaces as a visible
banner — you should never see that banner once real Yahoo data is flowing.

## Configuration

Copy `.env.example` to `.env` for local overrides. The frontend-facing variables are
`VITE_USE_MOCK_DATA` and `VITE_ENABLE_MANAGER_PROFILES`. Everything else (league ID, game ID, season,
and eventually Yahoo credentials) is server-side/CI-side configuration — see the security section below.

### Manager profile feature toggle

The GitHub Pages workflow maps the GitHub Actions **repository variable**
`MANAGER_PROFILES_ENABLED` to `VITE_ENABLE_MANAGER_PROFILES`. The feature defaults to **on** when the
GitHub variable is absent.

To disable the feature for the deployed site, create or edit:

`Repository → Settings → Secrets and variables → Actions → Variables → MANAGER_PROFILES_ENABLED`

Set its value to `false`, then rerun or push a build. No code change is required.

## Connecting Yahoo Fantasy

Not wired up yet — this section will be filled in as part of Phase 2 (Yahoo OAuth + ingestion), with
step-by-step instructions for registering a Yahoo application, completing the OAuth flow, obtaining a
refresh token, and storing everything in **GitHub Actions repository secrets**
(Repository → Settings → Secrets and variables → Actions). Planned secret/config names:

| Name | Type | Notes |
|---|---|---|
| `YAHOO_CLIENT_ID` | secret or config | Yahoo app client ID |
| `YAHOO_CLIENT_SECRET` | **secret** | Never committed, never logged |
| `YAHOO_REFRESH_TOKEN` | **secret** | Never committed, never logged |
| `YAHOO_LEAGUE_ID` | config | Not sensitive |
| `YAHOO_GAME_ID` | config | Not sensitive |
| `YAHOO_SEASON` | config | Not sensitive |

No secret will ever be prefixed `VITE_` or otherwise exposed to the frontend build.

## Roadmap

Building in the order laid out in the original plan:

1. ~~Project scaffold, mock data model, polished frontend~~ ✅ this phase
2. ~~Current-week dashboard, matchup pages, standings, team pages~~ ✅ this phase
3. Weekly superlatives *calculation engine* (the UI/data shape already exists)
4. League Record Book calculations
5. Power Rankings composite formula
6. Luck / expected record + strength of schedule
7. Historical weekly snapshot system (Season → Week → Matchup navigation with real history)
8. Playoff bracket
9. Yahoo OAuth + ingestion (`scripts/yahoo/`)
10. Derived-stats generation pipeline (`scripts/transform/`)
11. GitHub Actions (scheduled data refresh + Pages deploy)
12. Tests for the core calculations (win %, expected record, luck, SOS, streaks, records)
13. Final credential-exposure audit before going live with real league data

## Security

- The browser only ever fetches static JSON. It has no code path that touches OAuth.
- No secret is ever written to `data/`, `dist/`, git history, or logs.
- `.env` is git-ignored; only `.env.example` (placeholders only) is committed.
- Before Phase 2 ships, the repo and built `dist/` output will be audited for accidental credential
  exposure as required by the project plan.
