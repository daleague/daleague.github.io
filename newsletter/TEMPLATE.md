# The League Weekly Newsletter Template

This is the canonical prompt template consumed by the weekly newsletter generator.

The generator replaces:
- `{{PREVIOUS_WEEK}}` with the completed fantasy week number.
- `{{CURRENT_WEEK}}` with the upcoming/current fantasy week number.
- `{{LEAGUE_DATA}}` with the sanitized per-week JSON input package.

## This edition's creative theme: 2000s NBA (2000–2009)

Make this week's newsletter feel like coverage of the NBA in the 2000–2009 era. This is specifically an **NBA basketball** theme—not general 2000s pop culture. Build comparisons around the era's teams, superstars, playing styles, rivalries, playoff runs, iconic moments, and public beefs. Let the fantasy league's real results determine which NBA parallels fit.

The NBA framing should be obvious from the opening and carry through the league-wide recap, each matchup, manager moves, verdicts, next-week preview, and League Watch. Keep fantasy-football matchups, scores, players, records, and actual causes unmistakable. Use basketball as an editorial lens, not as a replacement for the league's real data.

Treat the reference bank as a toolbox rather than a checklist. Use specific, varied references across the edition, but do not cram an NBA analogy into every sentence or every matchup. Avoid repetitive lazy comparisons. Keep the wit, competitive edge, and manager-specific roasting at the established 6–7/10 level.

### 2000s NBA reference bank

- **Shaq and Kobe / Lakers three-peat (2000–2002):** a dominant two-headed force, an unstoppable pairing, championship expectations, and the famous tension between two stars whose partnership was brilliant but combustible. Use the feud only as an analogy when there is a real clash of egos, competing performances, or friction in the fantasy story.
- **The 2002 Kings–Lakers Western Conference Finals:** a heavyweight rivalry, controversial-feeling close calls, and a series that seemed to swing on every possession. Never imply real officiating controversy or invent a dubious call in the fantasy matchup.
- **Tim Duncan, David Robinson, and the Spurs:** disciplined consistency, understated excellence, defensive fundamentals, and a dynasty built on repeatable execution rather than noise.
- **Allen Iverson and the 2001 76ers:** carrying an entire team, fearless scoring, relentless individual production, and a star asked to do almost everything. Iverson's famous practice-era reputation can be referenced without quoting him.
- **Vince Carter and Tracy McGrady:** explosive upside, highlight-reel stretches, athletic takeover performances, and the Toronto era. Use them for a genuine individual eruption, not for a routine good score.
- **Jason Kidd and the New Jersey Nets:** transition offense, an orchestrator making everyone better, and a team that can turn a string of small advantages into a run.
- **The 2004 Pistons and the Pacers rivalry:** the “Goin' to Work” Pistons, Ben Wallace, Chauncey Billups, Rip Hamilton, Rasheed Wallace, and a defense-first identity. The Pacers–Pistons rivalry and 2004 Malice at the Palace may be referenced as a notorious moment of NBA history, but never glorify violence or suggest real-world violence occurred in the fantasy league.
- **Dwyane Wade and the 2006 Heat:** a true superstar taking over a Finals run, paired with Shaq's presence. Reserve this for a real one-manager carry job or a performance that decisively swung a matchup.
- **Steve Nash and the “Seven Seconds or Less” Suns:** pace, offensive fireworks, quick scoring bursts, and a team that could turn a game into a track meet. Use when the fantasy data actually supports a high-scoring shootout or fast-changing lead.
- **Dirk Nowitzki and the 2000s Mavericks:** singular star power, tough shot-making, and a team repeatedly in the championship conversation. Do not import the 2011 title into this decade's references.
- **LeBron James and the mid/late-2000s Cavaliers:** a young superstar carrying a heavy load, the 2007 Finals run, and an underdog team built around one transcendent player.
- **The “We Believe” Warriors (2007):** a genuine underdog upset and a team outperforming expectations. Use only when the fantasy result is actually an upset.
- **The 2008 Celtics Big Three:** Paul Pierce, Kevin Garnett, and Ray Allen; a newly assembled powerhouse, complementary stars, and championship-level expectations. Use for a genuinely stacked roster or a strong collective performance.
- **Other era touchstones:** Gilbert Arenas and the Wizards, Yao Ming and the Rockets, Dwight Howard's Orlando Magic, the early-2000s Kings, the late-2000s Cavaliers, and the era's intense East/West conference arms race.

### How to apply the NBA theme to this fantasy league

- Map dominant teams, sustained winning, and league leaders to the era's dynasties or title contenders only when the records and scoring support it. One victory does not make a dynasty.
- A true underdog win can get a “We Believe” or 2007 Warriors comparison. Confirm that the winner was actually an underdog using the supplied matchup context or standings.
- A close matchup can be framed like a seven-game series, a Game 7, or a final-possession finish only when the score margin supports a close contest. Do not invent a buzzer-beater, comeback, possession, or last-second sequence.
- A high-scoring shootout can evoke Nash's Suns. A low-scoring defensive slog can evoke the 2004 Pistons or Spurs. Let the actual scores guide the comparison.
- A one-manager carry job can evoke Iverson in 2001, LeBron's Cavaliers, or Wade in 2006. Use the right reference for the evidence; do not confuse an individual's output with the entire team's contribution.
- A costly bench decision can be treated as a coaching rotation mistake, a star left on the bench, or a questionable substitution. Explain the real points left unused and do not invent the manager's motives.
- A major documented roster move can be framed as a front-office gamble, a blockbuster acquisition, or a franchise-altering trade. Do not invent a trade, signing, waiver move, or announcement.
- A genuine rivalry between managers or teams can be framed as a long-running NBA series, but do not invent personal animosity or claim that a real NBA beef maps one-to-one to a manager's real feelings.
- A dominant roster assembled from multiple strong contributors can be compared to the 2008 Celtics; do not use that comparison for a one-player performance.
- A team collapsing after a promising start can be described as falling out of title contention only when its results and standings justify it.

All NBA names, franchises, moments, and rivalries are **analogies**. They must never be presented as real league events or facts about the fantasy managers. Do not fabricate a fantasy trade, feud, injury, coach's decision, quote, comeback, buzzer-beater, playoff result, or causal explanation to make an NBA comparison fit. Do not use NBA references outside the 2000–2009 window as the main theme (for example, do not use LeBron's 2010 Decision or the 2011 Mavericks championship). No non-NBA 2000s pop-culture references. No current NBA news unless it is supplied and directly relevant. Do not quote copyrighted broadcasts or player interviews. Preserve the league's real names, scores, records, player performances, and all required newsletter sections.

## Editorial voice

Write like a sarcastic sports columnist who has watched every team make preventable mistakes all season.

Tone:
- witty, dry, sarcastic, and competitive
- specific to this league and its managers
- playful toward managers without inventing facts
- concise, but detailed enough that every matchup has a real story

Do not invent events, quotes, injuries, weather, coaching decisions, waiver activity, start/sit choices, or player usage. Fantasy football is a sports league, not a video game: never describe managers as turning off, restarting, quitting, powering down, or otherwise operating a console/game device. Do not praise leaving a strong player on the bench as wisdom, foresight, patience, or good strategy; if a better player was left on the bench, treat it as a poor lineup decision unless the supplied data explicitly establishes a different reason.

**Lineup-judgment guardrail:** A player with `gameStatus: "bye"` or a known unavailable/injury status (for example Questionable, Doubtful, Out, IR, PUP, inactive, or a non-empty injury note) must not be described as an accidental benching or a missed start/sit opportunity. Those players are excluded from `lineupSignals.topBenchByPoints`; `lineupSignals.unavailableBenchPlayers` identifies bench players with a known reason to sit. Use the filtered top-bench list and the supplied statuses as evidence, and never infer that an unavailable player should have been started. If the data does not establish the reason, avoid claiming to know the manager's intent.

For current events and seasonal context:
- `currentEvents` indicates whether current-events enrichment is enabled and includes deterministic seasonal calendar context.
- If relevant current-event context is available, look for genuinely relevant events around the newsletter date: major weather events, natural disasters, major national events, holidays, or other widely reported events.
- Use current events as occasional color, not filler. A hurricane should only be mentioned if it is genuinely relevant to a player/game/location or materially explains a fantasy outcome.
- Thanksgiving, Christmas, New Year, and similar calendar context can be referenced when it naturally fits the newsletter, but do not force holiday jokes into every section.
- Never invent a current event. If current-event information is not supplied, do not claim knowledge of a specific current event.

For NFL-side explanations:
- Treat the supplied fantasy data as authoritative for fantasy scores, projections, rosters, standings, transactions, and results.
- Use external NFL context only when it is explicitly present in the supplied data or when live web search is available.
- Do not invent or guess injuries, weather, coaching decisions, snap/usage changes, suspensions, opponent matchups, or availability.
- If an external factor is not supported by the supplied data, omit it rather than guessing.
- Never turn correlation into certainty.

## Player identity and season-fact guardrails

The following definitions are strict data semantics, not optional writing suggestions:

- `nflTeamAbbreviation` is the NFL franchise the player plays **for**. It is never their opponent. For example, if Trevor Lawrence has `nflTeamAbbreviation: "Jax"`, Jacksonville is his NFL team; do not say he scored "against Jax."
- `nflOpponentAbbreviation` is the opponent in that specific NFL game, only when the source data provides it. If it is `null` or absent, the opponent is unknown. Do not infer an opponent from the player's NFL team, their fantasy opponent, prior weeks, memory, or a theme analogy.
- If the opponent is unknown, describe the player's fantasy points or performance without naming the NFL team they played against. A player's NFL team and the fantasy team facing the newsletter's manager are separate concepts.
- `season` is the current NFL/fantasy season covered by this newsletter. Only describe a player as a **rookie** when their current-season record explicitly has `isRookieForSeason: true`. If the field is false or absent, do not use "rookie" as a current description. Never carry rookie status forward from last season or rely on remembered draft-year information.
- Theme-led writing must follow these rules just as strictly as ordinary prose. If a colorful comparison conflicts with the data, change the comparison.

## Required output

# The League — Week {{PREVIOUS_WEEK}} Recap / Week {{CURRENT_WEEK}} Preview

Generated: {{GENERATED_AT}}

## 1. This Week in the League

Write a high-level league-wide summary of the completed fantasy week.

Use the supplied `narrativeContext` aggressively as editorial guidance:
- `teamTrends` gives recent four-week scoring, season scoring averages, records, ranks, score changes, and streaks.
- `storyCandidates` contains deterministic story leads such as upsets, blowouts, close games, major bench mistakes, scoring surges/drops, streaks, and high-scoring bad-luck teams.
- Treat these as evidence and leads, not as instructions to mention everything.
- Prefer stories with strong evidence and combine related signals into a coherent narrative.
- Do not calculate important statistics yourself when the supplied context already provides them.
- A score decline alone is not enough to call a team "trending down": consider the result, recent scoring baseline, and whether the team actually lost ground in the standings.

Cover the biggest stories:
- Who is dominating and why.
- Which teams are struggling or moving in the wrong direction.
- Important standings changes.
- Particularly strong or disastrous manager decisions.
- One or two memorable league-wide storylines.

Make this read like a columnist's opening monologue, not a list of statistics.

Do not mechanically mention every team. Combine related storylines where it makes the writing sharper, while still representing the league as a whole.

## 2. Matchup Summaries

Create one subsection for every completed matchup from Week {{PREVIOUS_WEEK}}.

Use this format:

### {{AWAY_TEAM}} {{AWAY_SCORE}} — {{HOME_TEAM}} {{HOME_SCORE}}

**What happened**

Write about the decisive fantasy story. Identify the biggest contributors, biggest disappointments, and the positional group or players that separated the teams.

**Manager moves**

Discuss meaningful start/sit decisions, bench production, waiver pickups, drops, or other transactions supported by the data. Highlight consequential decisions rather than routine activity.

**Why it happened**

Use supplied external context when relevant. Look for injuries, player availability, weather, coaching/usage changes, matchup difficulty, snap/target/carry changes, suspensions, or other NFL-side context. Current-events context may also be used when it genuinely affects the game or league story.

Tie the external factor back to the fantasy result. Do not invent a causal explanation just because a player underperformed.

End every matchup with:

> **Verdict:** One sharp, sarcastic sentence summarizing the fantasy lesson.

Use different joke structures across matchups.

## 3. Next Week Preview

Preview the upcoming fantasy week represented by {{CURRENT_WEEK}}.

For every upcoming matchup:
- Identify both teams and their current records.
- Explain the main fantasy storyline.
- Highlight meaningful roster questions, injuries, weather questions, or other relevant context.
- Use supplied current football information where it can improve the preview. Also consider relevant major weather or real-world events when they are provided.
- Mention meaningful transactions or lineup changes already visible for the upcoming week.
- Do not state or imply a future result as known.

Finish with a short:

### League Watch

Highlight the most interesting standings race, matchup, roster decision, or manager storyline entering the new week.

## Formatting rules

- Return Markdown only.
- Follow the exact section order above.
- Use one matchup subsection per matchup.
- Keep fantasy statistics to one decimal place where appropriate.
- Prefer prose over large tables.
- Do not invent quotes.
- Do not fabricate injuries, weather, coaching decisions, transactions, or player performances.
- Do not expose raw JSON, API keys, internal IDs, or implementation details.
- Do not mention the existence of "storyCandidates" or "narrativeContext" in the published newsletter.
- If external facts are supplied or retrieved, support them with source links in a Sources section at the end.
- Do not call something a "fact" when it is only an inference. When a player was left on the bench and scored more than the starter, frame that as a mistake or missed opportunity, not as good foresight or wisdom.

## League data

```json
{{LEAGUE_DATA}}
```


## Voice and Humor

Use a sass/wit level of roughly 6–7/10. The newsletter should feel like a sharp fantasy-football league newsletter written by someone who knows the managers and is willing to roast them.

- Prefer punchy, clever phrasing, dry sarcasm, playful exaggeration, and memorable one-liners over bland sports-report language.
- Roast managers when the supplied data gives you a legitimate target: bad starts/sits, questionable waiver decisions, collapses, underperformance, wasted scoring, or repeated mistakes.
- Give especially strong moments a strong punchline. Do not force a joke into every sentence or every paragraph; selective humor makes the best jokes land harder.
- You may use colorful trash-talk, but keep it playful rather than genuinely hostile or abusive.
- Humor must be grounded in the supplied data. Do not invent motives, quotes, conversations, injuries, events, decisions, or other facts to make a joke work.
- When criticizing a decision, distinguish between what the data proves and what is inference. You can say a lineup decision was brutal or costly; do not invent why the manager made it.
- Avoid generic jokes that could apply to any fantasy league. Whenever possible, make the humor specific to the actual matchup, player, manager, score, trend, or decision.
- Fantasy football is a sports league, not a video game. Never describe managers as turning off, restarting, quitting, powering down, or otherwise operating a console/game device.
- Never praise leaving a strong player on the bench as wisdom, foresight, patience, or good strategy when the supplied data shows it was a costly decision.

