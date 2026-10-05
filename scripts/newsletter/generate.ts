import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

type Json = Record<string, unknown>;

interface Source {
  title: string;
  url: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function latestWeek(weeks: number[]): number {
  return weeks.length ? Math.max(...weeks) : 0;
}

function transactionInPreviousWeek(
  transaction: Json,
  generatedAt: string,
): boolean {
  const raw = typeof transaction.timestamp === "string" ? transaction.timestamp : "";
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return false;

  const end = Date.parse(generatedAt);
  if (!Number.isFinite(end)) return false;

  const start = end - 7 * 24 * 60 * 60 * 1000;
  return timestamp >= start && timestamp <= end;
}

function playerBrief(player: Json): Json {
  return {
    name: player.name,
    slot: player.slot,
    actualPosition: player.actualPosition,
    points: player.points,
    gameStatus: player.gameStatus,
    nflTeam: player.nflTeam,
    opponent: player.opponent,
  };
}


function matchupWithSignals(matchup: Json, teamById: Map<string, Json>): Json {
  const addSignals = (side: Json) => {
    const players = Array.isArray(side.players) ? (side.players as Json[]) : [];
    const starters = players.filter((player) => player.isStarter);
    const bench = players.filter((player) => !player.isStarter);
    const team = teamById.get(String(side.teamId)) ?? {};
    return {
      teamId: side.teamId,
      teamName: team.name,
      managerName: team.managerName,
      score: side.score,
      projectedScore: side.projectedScore,
      winProbability: side.winProbability,
      players: players.map(playerBrief),
      lineupSignals: {
        topBenchByPoints: [...bench].sort((a, b) => Number(b.points ?? 0) - Number(a.points ?? 0)).slice(0, 3).map(playerBrief),
        lowestScoringStarters: [...starters].sort((a, b) => Number(a.points ?? 0) - Number(b.points ?? 0)).slice(0, 3).map(playerBrief),
      },
    };
  };
  return {
    matchupId: matchup.matchupId,
    season: matchup.season,
    week: matchup.week,
    status: matchup.status,
    winnerTeamId: matchup.winnerTeamId,
    isPlayoffs: matchup.isPlayoffs,
    playoffRound: matchup.playoffRound,
    home: addSignals(matchup.home as Json),
    away: addSignals(matchup.away as Json),
  };
}

function buildNarrativeContext(
  history: Json[],
  standings: Json[],
  teams: Json[],
  previousWeek: number,
): Json {
  const teamById = new Map(teams.map((team) => [String(team.teamId), team]));
  const finals = history
    .filter((m) => m.status === "final" && Number(m.week) <= previousWeek)
    .sort((a, b) => Number(a.week) - Number(b.week));

  const stats = new Map<string, { scores: number[]; results: string[]; pf: number; pa: number }>();
  for (const m of finals) {
    for (const key of ["home", "away"]) {
      const side = m[key] as Json;
      const opp = m[key === "home" ? "away" : "home"] as Json;
      const id = String(side.teamId);
      const row = stats.get(id) ?? { scores: [], results: [], pf: 0, pa: 0 };
      row.scores.push(Number(side.score ?? 0));
      row.results.push(String(m.winnerTeamId ?? "") === id ? "W" : "L");
      row.pf += Number(side.score ?? 0);
      row.pa += Number(opp.score ?? 0);
      stats.set(id, row);
    }
  }

  const round = (n: number) => Math.round(n * 10) / 10;
  const teamTrends = teams.map((team) => {
    const id = String(team.teamId);
    const row = stats.get(id) ?? { scores: [], results: [], pf: 0, pa: 0 };
    const recent = row.scores.slice(-4);
    const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const seasonAvg = row.scores.length ? row.pf / row.scores.length : 0;
    const streakResult = row.results.at(-1);
    let streak = 0;
    for (let i = row.results.length - 1; i >= 0 && row.results[i] === streakResult; i--) streak++;
    return {
      teamId: id,
      teamName: team.name,
      managerName: team.managerName,
      rank: standings.find((s) => String(s.teamId) === id)?.rank ?? null,
      record: String(row.results.filter((r) => r === "W").length) + "-" + String(row.results.filter((r) => r === "L").length),
      seasonAvg: round(seasonAvg),
      seasonPaAvg: round(row.scores.length ? row.pa / row.scores.length : 0),
      recent4: recent.map((score, i) => ({ week: finals[finals.length - recent.length + i]?.week, points: round(score) })),
      recent4Avg: round(recentAvg),
      latestScore: recent.length ? round(recent.at(-1)!) : null,
      priorScore: recent.length > 1 ? round(recent.at(-2)!) : null,
      latestScoreDelta: recent.length > 1 ? round(recent.at(-1)! - recent.at(-2)!) : null,
      streak: streakResult ? { type: streakResult, count: streak } : null,
    };
  });

  const previous = finals.filter((m) => Number(m.week) === previousWeek);
  const candidates: Json[] = [];

  for (const m of previous) {
    const home = m.home as Json, away = m.away as Json;
    const winnerId = String(m.winnerTeamId ?? "");
    const winner = winnerId === String(home.teamId) ? home : away;
    const loser = winnerId === String(home.teamId) ? away : home;
    const margin = Number(winner.score ?? 0) - Number(loser.score ?? 0);
    const prob = Number(winner.winProbability ?? NaN);
    const projectedDiff = Number(winner.projectedScore ?? NaN) - Number(loser.projectedScore ?? NaN);

    if (Number.isFinite(prob) && prob < 50) candidates.push({
      type: "upset", priority: round(50 - prob), team: teamById.get(String(winner.teamId))?.name,
      evidence: "Won despite a " + round(prob) + "% pre-matchup win probability."
    });
    else if (Number.isFinite(projectedDiff) && projectedDiff < 0) candidates.push({
      type: "upset", priority: round(-projectedDiff), team: teamById.get(String(winner.teamId))?.name,
      evidence: "Won while projected to score " + round(-projectedDiff) + " fewer points."
    });

    if (margin >= 30) candidates.push({
      type: "blowout", priority: round(margin), team: teamById.get(String(winner.teamId))?.name,
      evidence: "Won by " + round(margin) + " points."
    });
    if (margin <= 5) candidates.push({
      type: "close_game", priority: round(5 - margin), team: teamById.get(String(winner.teamId))?.name,
      evidence: "Won by only " + round(margin) + " points."
    });

    for (const side of [home, away]) {
      const id = String(side.teamId);
      const players = Array.isArray(side.players) ? side.players as Json[] : [];
      const starters = players.filter((p) => p.isStarter);
      const bench = players.filter((p) => !p.isStarter);
      for (const benched of bench) {
        const position = String(benched.actualPosition ?? "").toUpperCase();
        const eligible = starters.filter((s) => {
          const slot = String(s.slot ?? "").toUpperCase();
          return (position === "QB" && slot === "QB") ||
            (position === "RB" && ["RB", "FLEX", "W/R/T"].includes(slot)) ||
            (position === "WR" && ["WR", "FLEX", "W/R/T"].includes(slot)) ||
            (position === "TE" && ["TE", "FLEX", "W/R/T"].includes(slot)) ||
            (["DEF", "D/ST"].includes(position) && slot === "DEF") || (position === "K" && slot === "K");
        });
        if (!eligible.length) continue;
        const replacement = [...eligible].sort((a, b) => Number(a.points ?? 0) - Number(b.points ?? 0))[0];
        const gain = Number(benched.points ?? 0) - Number(replacement.points ?? 0);
        if (gain >= 8) candidates.push({
          type: "bench_mistake", priority: round(gain), team: teamById.get(id)?.name,
          evidence: "Left " + String(benched.name) + " (" + round(Number(benched.points ?? 0)) + ") on the bench for " +
            String(replacement.name) + " (" + round(Number(replacement.points ?? 0)) + "), a " + round(gain) + "-point swing.",
          wouldHaveChangedResult: winnerId !== id && Number(side.score ?? 0) + gain > Number((winnerId === String(home.teamId) ? away : home).score ?? 0)
        });
      }
    }
  }

  for (const trend of teamTrends) {
    const recent = Array.isArray(trend.recent4) ? trend.recent4 : [];
    if (recent.length >= 3 && Number(trend.latestScoreDelta ?? 0) <= -20) candidates.push({
      type: "scoring_drop", priority: Math.abs(Number(trend.latestScoreDelta)),
      team: trend.teamName, evidence: "Latest score fell " + Math.abs(Number(trend.latestScoreDelta)) + " points from the prior week."
    });
    if (recent.length >= 3 && Number(trend.latestScoreDelta ?? 0) >= 20) candidates.push({
      type: "scoring_surge", priority: Number(trend.latestScoreDelta),
      team: trend.teamName, evidence: "Latest score rose " + Number(trend.latestScoreDelta) + " points from the prior week."
    });
    if (trend.streak && Number(trend.streak.count) >= 3) candidates.push({
      type: "streak", priority: Number(trend.streak.count) * 10,
      team: trend.teamName, evidence: String(trend.streak.count) + "-game " + String(trend.streak.type) + " streak."
    });
    const [wins, losses] = String(trend.record).split("-").map(Number);
    if (Number.isFinite(wins) && Number.isFinite(losses) && losses > wins && Number(trend.seasonAvg) >= 130) candidates.push({
      type: "high_scoring_bad_luck", priority: Number(trend.seasonAvg),
      team: trend.teamName, evidence: "A losing record despite averaging " + Number(trend.seasonAvg) + " points per game."
    });
  }

  candidates.sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
  return { teamTrends, storyCandidates: candidates.slice(0, 20) };
}

function buildHistoricalStandings(history: Json[], teams: Json[], throughWeek: number): Json[] {
  const rows = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>();
  for (const matchup of history) {
    if (matchup.status !== "final" || Number(matchup.week) > throughWeek) continue;
    const home = matchup.home as Json;
    const away = matchup.away as Json;
    for (const [side, opponent] of [[home, away], [away, home]] as Json[][]) {
      const id = String(side.teamId);
      const row = rows.get(id) ?? { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      row.pointsFor += Number(side.score ?? 0);
      row.pointsAgainst += Number(opponent.score ?? 0);
      if (String(matchup.winnerTeamId ?? "") === id) row.wins += 1;
      else row.losses += 1;
      rows.set(id, row);
    }
  }

  return teams
    .map((team) => {
      const id = String(team.teamId);
      const row = rows.get(id) ?? { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      return {
        teamId: id,
        teamName: team.name,
        managerName: team.managerName,
        wins: row.wins,
        losses: row.losses,
        ties: 0,
        pointsFor: Math.round(row.pointsFor * 10) / 10,
        pointsAgainst: Math.round(row.pointsAgainst * 10) / 10,
      };
    })
    .sort((a, b) => Number(b.wins) - Number(a.wins) || Number(b.pointsFor) - Number(a.pointsFor))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function previewMatchup(matchup: Json, teamById: Map<string, Json>): Json {
  const previewSide = (side: Json) => {
    const team = teamById.get(String(side.teamId)) ?? {};
    const players = Array.isArray(side.players) ? side.players as Json[] : [];
    return {
      teamId: side.teamId,
      teamName: team.name,
      managerName: team.managerName,
      players: players.map((player) => ({
        name: player.name,
        actualPosition: player.actualPosition,
        slot: player.slot,
        nflTeam: player.nflTeam,
        opponent: player.opponent,
      })),
    };
  };
  return {
    matchupId: matchup.matchupId,
    season: matchup.season,
    week: matchup.week,
    status: "upcoming",
    home: previewSide(matchup.home as Json),
    away: previewSide(matchup.away as Json),
  };
}

function replaceAll(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(key).join(value),
    template,
  );
}

function collectSources(value: unknown, sources: Source[] = []): Source[] {
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, sources);
    return sources;
  }

  if (!value || typeof value !== "object") return sources;

  const object = value as Record<string, unknown>;
  const type = typeof object.type === "string" ? object.type : "";

  if (
    type === "url_citation" &&
    typeof object.url === "string"
  ) {
    sources.push({
      title:
        typeof object.title === "string" && object.title
          ? object.title
          : object.url,
      url: object.url,
    });
  }

  const web =
    object.web && typeof object.web === "object"
      ? (object.web as Record<string, unknown>)
      : null;

  if (web && typeof web.uri === "string") {
    sources.push({
      title:
        typeof web.title === "string" && web.title
          ? web.title
          : web.uri,
      url: web.uri,
    });
  }

  if (
    typeof object.url === "string" &&
    typeof object.title === "string" &&
    (type === "web_search_call" || type === "source")
  ) {
    sources.push({ title: object.title, url: object.url });
  }

  for (const child of Object.values(object)) collectSources(child, sources);
  return sources;
}

function uniqueSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function extractOpenAIText(body: Json): string {
  if (typeof body.output_text === "string") return body.output_text;

  const chunks: string[] = [];
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Json).content)
      ? ((item as Json).content as Json[])
      : [];
    for (const block of content) {
      if (typeof block.text === "string") chunks.push(block.text);
    }
  }
  return chunks.join("\n\n").trim();
}

function extractGeminiText(body: Json): string {
  const candidates = Array.isArray(body.candidates)
    ? (body.candidates as Json[])
    : [];
  return candidates
    .flatMap((candidate) =>
      Array.isArray(candidate.content)
        ? (candidate.content as Json[])
        : Array.isArray((candidate.content as Json | undefined)?.parts)
          ? (((candidate.content as Json).parts as Json[]) ?? [])
          : [],
    )
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function generateWithOpenAI(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ text: string; sources: Source[] }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: "web_search" }],
      store: false,
    }),
  });

  const body = (await response.json()) as Json;
  if (!response.ok) {
    throw new Error(
      `OpenAI newsletter generation failed (${response.status}): ${JSON.stringify(body).slice(0, 1000)}`,
    );
  }

  const text = extractOpenAIText(body);
  if (!text) throw new Error("OpenAI returned no newsletter text.");

  return { text, sources: uniqueSources(collectSources(body)) };
}

async function generateWithGemini(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ text: string; sources: Source[] }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );

  const body = (await response.json()) as Json;
  if (!response.ok) {
    throw new Error(
      `Gemini newsletter generation failed (${response.status}): ${JSON.stringify(body).slice(0, 1000)}`,
    );
  }

  const text = extractGeminiText(body);
  if (!text) throw new Error("Gemini returned no newsletter text.");

  return { text, sources: uniqueSources(collectSources(body)) };
}

function appendSources(markdown: string, sources: Source[]): string {
  if (sources.length === 0 || /(^|\n)## Sources\s*$/m.test(markdown)) {
    return markdown.trimEnd() + "\n";
  }

  const lines = [
    "",
    "## Sources",
    "",
    ...sources.map((source) => `- [${source.title}](${source.url})`),
  ];

  return markdown.trimEnd() + "\n" + lines.join("\n") + "\n";
}

async function main() {
  if (process.env.NEWSLETTER_ENABLED !== "true") {
    console.log("[newsletter] disabled (set NEWSLETTER_ENABLED=true to enable it).");
    return;
  }

  const root = process.cwd();
  const league = await readJson<Json>(join(root, "data/current/league.json"));
  const teams = await readJson<Json[]>(join(root, "data/current/teams.json"));
  const standings = await readJson<Json[]>(join(root, "data/current/standings.json"));
  const matchupsHistory = await readJson<Json[]>(
    join(root, "data/current/matchups-history.json"),
  );
  const matchupsCurrent = await readJson<Json[]>(
    join(root, "data/current/matchups-current.json"),
  );
  const superlativesHistory = await readJson<Json[]>(
    join(root, "data/current/superlatives-history.json"),
  );
  const transactions = await readJson<Json[]>(
    join(root, "data/current/transactions.json"),
  );
  const rosters = (await readJson<Json>(
    join(root, "data/current/rosters.json"),
  )) as Record<string, Json[]>;
  const teamById = new Map(teams.map((team) => [String(team.teamId), team]));

  const completedWeeks = Array.isArray(league.completedWeeks)
    ? (league.completedWeeks as number[])
    : [];
  const previousWeek = process.env.NEWSLETTER_WEEK
    ? Number(process.env.NEWSLETTER_WEEK)
    : latestWeek(completedWeeks);

  if (!Number.isInteger(previousWeek) || previousWeek <= 0) {
    throw new Error("Could not determine the previous completed fantasy week.");
  }
  if (!completedWeeks.includes(previousWeek)) {
    throw new Error(
      `Requested newsletter week ${previousWeek} is not listed as completed.`,
    );
  }

  const isBackfill = Boolean(process.env.NEWSLETTER_WEEK);
  const currentWeek = Number(league.currentWeek);
  const upcomingWeek = previousWeek + 1;
  const generatedAt =
    typeof league.lastUpdatedAt === "string"
      ? league.lastUpdatedAt
      : new Date().toISOString();

  const outputDir = join(root, "newsletter/output");
  const dataDir = join(root, "newsletter/data");
  await mkdir(outputDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const outputPath = join(outputDir, `week-${previousWeek}.md`);
  const dataPath = join(dataDir, `week-${previousWeek}.json`);

  const previousMatchups = matchupsHistory
    .filter((matchup) => Number(matchup.week) === previousWeek)
    .map((matchup) => matchupWithSignals(matchup, teamById));
  const upcomingMatchups = isBackfill
    ? matchupsHistory
        .filter((matchup) => Number(matchup.week) === upcomingWeek)
        .map((matchup) => previewMatchup(matchup, teamById))
    : matchupsCurrent
        .filter((matchup) => Number(matchup.week) === upcomingWeek)
        .map((matchup) => matchupWithSignals(matchup, teamById));

  const previousSuperlatives = superlativesHistory.filter(
    (superlative) => Number(superlative.week) === previousWeek,
  );

  const previousWeekTransactions = (isBackfill ? [] : transactions
    .filter((transaction) =>
      transactionInPreviousWeek(transaction, generatedAt),
    ))
    .map((transaction) => ({
      timestamp: transaction.timestamp,
      type: transaction.type,
      teamId: transaction.teamId,
      playersAdded: transaction.playersAdded,
      playersDropped: transaction.playersDropped,
      faabAmount: transaction.faabAmount,
      note: transaction.note,
    }))
    .sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)),
    );

  const context = {
    generatedAt,
    season: league.season,
    league: {
      name: league.name,
      numTeams: league.numTeams,
      currentWeek: upcomingWeek,
      completedWeeks,
      timezone: league.timezone,
    },
    previousWeek: {
      week: previousWeek,
      matchups: previousMatchups,
      standings: isBackfill ? buildHistoricalStandings(matchupsHistory, teams, previousWeek) : standings,
      superlatives: previousSuperlatives,
      transactions: previousWeekTransactions,
    },
    upcomingWeek: {
      week: upcomingWeek,
      matchups: upcomingMatchups,
      rosters,
    },
    teams,
    narrativeContext: buildNarrativeContext(
      matchupsHistory,
      isBackfill ? buildHistoricalStandings(matchupsHistory, teams, previousWeek) : standings,
      teams,
      previousWeek,
    ),
  };

  await writeFile(dataPath, JSON.stringify(context, null, 2) + "\n", "utf8");

  if (await fileExists(outputPath) && process.env.NEWSLETTER_FORCE !== "true") {
    console.log(`[newsletter] week ${previousWeek} already exists; skipping generation.`);
    return;
  }

  const template = await readFile(
    join(root, "newsletter/TEMPLATE.md"),
    "utf8",
  );
  const prompt = replaceAll(template, {
    "{{PREVIOUS_WEEK}}": String(previousWeek),
    "{{CURRENT_WEEK}}": String(upcomingWeek),
    "{{GENERATED_AT}}": generatedAt,
    "{{LEAGUE_DATA}}": JSON.stringify(context, null, 2),
  });

  const provider = (process.env.NEWSLETTER_PROVIDER || "openai").toLowerCase();
  const model = required("NEWSLETTER_MODEL");

  const generated =
    provider === "openai"
      ? await generateWithOpenAI(prompt, model, required("OPENAI_API_KEY"))
      : provider === "gemini"
        ? await generateWithGemini(prompt, model, required("GEMINI_API_KEY"))
        : (() => {
            throw new Error(
              `Unsupported NEWSLETTER_PROVIDER="${provider}". Use "openai" or "gemini".`,
            );
          })();

  const newsletter = appendSources(generated.text, generated.sources);
  await writeFile(outputPath, newsletter, "utf8");

  console.log(
    `[newsletter] generated Week ${previousWeek} recap / Week ${upcomingWeek} preview with ${provider} (${model}); web sources: ${generated.sources.length}`,
  );
}

main().catch((error) => {
  console.error("[newsletter] generation failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
