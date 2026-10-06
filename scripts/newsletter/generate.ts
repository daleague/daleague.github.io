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

function historicalTeamName(history: Json[], teamId: string, week: number, fallback: string): string {
  for (const matchup of history.filter((m) => Number(m.week) === week)) {
    for (const side of [matchup.home, matchup.away] as Json[]) {
      if (String(side.teamId) === teamId && typeof side.teamName === "string" && side.teamName) return side.teamName;
    }
  }
  return fallback;
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
    playerId: player.playerId,
    name: player.name,
    slot: player.slot,
    actualPosition: player.actualPosition,
    points: player.points,
    gameStatus: player.gameStatus,
    nflTeam: player.nflTeam,
    opponent: player.opponent,
  };
}


function matchupWithSignals(matchup: Json, teamById: Map<string, Json>, useManagerNames = false): Json {
  const addSignals = (side: Json) => {
    const players = Array.isArray(side.players) ? (side.players as Json[]) : [];
    const starters = players.filter((player) => player.isStarter);
    const bench = players.filter((player) => !player.isStarter);
    const team = teamById.get(String(side.teamId)) ?? {};
    return {
      teamId: side.teamId,
      teamName: useManagerNames ? String(team.managerName ?? "Unknown Manager") : String(side.teamName ?? team.name),
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

function buildMultiWeekStoryCandidates(finals: Json[], transactions: Json[], teams: Json[], previousWeek: number, useManagerNames = false): Json[] {
  const round = (n: number) => Math.round(n * 10) / 10;
  const teamById = new Map(teams.map((t) => [String(t.teamId), t]));
  const playerWeeks = new Map<string, Json[]>();
  const lineupMistakes = new Map<string, Json[]>();
  for (const matchup of finals) {
    const week = Number(matchup.week);
    if (week > previousWeek) continue;
    for (const side of [matchup.home, matchup.away] as Json[]) {
      const teamId = String(side.teamId);
      const teamName = useManagerNames ? String(teamById.get(teamId)?.managerName ?? "Unknown Manager") : String(side.teamName ?? teamById.get(teamId)?.name ?? "Unknown Team");
      const players = Array.isArray(side.players) ? side.players as Json[] : [];
      for (const player of players) {
        const playerId = String(player.playerId ?? player.name ?? "");
        if (!playerId) continue;
        const rows = playerWeeks.get(playerId) ?? [];
        rows.push({ week, teamId, teamName, points: Number(player.points ?? 0), started: Boolean(player.isStarter), name: player.name });
        playerWeeks.set(playerId, rows);
      }
      const starters = players.filter((p) => p.isStarter);
      const bench = players.filter((p) => !p.isStarter);
      for (const benched of bench) {
        const pos = String(benched.actualPosition ?? "").toUpperCase();
        const eligible = starters.filter((s) => {
          const slot = String(s.slot ?? "").toUpperCase();
          return (pos === "QB" && slot === "QB") || (pos === "RB" && ["RB", "FLEX", "W/R/T"].includes(slot)) ||
            (pos === "WR" && ["WR", "FLEX", "W/R/T"].includes(slot)) || (pos === "TE" && ["TE", "FLEX", "W/R/T"].includes(slot)) ||
            (["DEF", "D/ST"].includes(pos) && slot === "DEF") || (pos === "K" && slot === "K");
        });
        if (!eligible.length) continue;
        const replacement = [...eligible].sort((a,b) => Number(a.points ?? 0) - Number(b.points ?? 0))[0];
        const gain = Number(benched.points ?? 0) - Number(replacement.points ?? 0);
        if (gain < 8) continue;
        const rows = lineupMistakes.get(teamId) ?? [];
        rows.push({ week, gain, bench: String(benched.name), starter: String(replacement.name), teamName });
        lineupMistakes.set(teamId, rows);
      }
    }
  }
  const candidates: Json[] = [];
  for (const [teamId, mistakes] of lineupMistakes) {
    if (mistakes.length >= 2) {
      const total = mistakes.reduce((s, x) => s + Number(x.gain), 0);
      candidates.push({
        type: "repeated_start_sit_mistakes",
        priority: round(total + mistakes.length * 10),
        team: String(mistakes[0].teamName ?? teamById.get(teamId)?.name ?? "Unknown Team"),
        evidence: mistakes.map((x) => "Week " + x.week + ": left " + x.bench + " on the bench for " + x.starter + ", costing " + round(Number(x.gain)) + " points").join("; "),
        occurrences: mistakes.length,
        pointsLeft: round(total),
      });
    }
  }
  for (const [playerId, rows] of playerWeeks) {
    const byTeam = new Map<string, Json[]>();
    for (const row of rows) {
      const arr = byTeam.get(String(row.teamId)) ?? [];
      arr.push(row); byTeam.set(String(row.teamId), arr);
    }
    for (const teamRows of byTeam.values()) {
      const recent = teamRows.filter((r) => Number(r.week) >= previousWeek - 2).sort((a,b) => Number(a.week)-Number(b.week));
      if (recent.length < 3) continue;
      const avg = recent.reduce((s,r) => s + Number(r.points), 0) / recent.length;
      if (avg >= 25 && recent.every((r) => Boolean(r.started))) {
        candidates.push({
          type: "player_carry",
          priority: round(avg * recent.length),
          team: String(recent[0].teamName),
          player: String(recent[0].name ?? playerId),
          evidence: "Scored " + recent.map(r => round(Number(r.points))).join(", ") + " over Weeks " + recent.map(r => r.week).join(", ") + ", averaging " + round(avg) + ".",
        });
      }
    }
  }
  const txs = [...transactions].sort((a,b) => Date.parse(String(a.timestamp ?? "")) - Date.parse(String(b.timestamp ?? "")));
  for (const tx of txs) {
    const teamId = String(tx.teamId ?? "");
    const adds = Array.isArray(tx.playersAdded) ? tx.playersAdded as Json[] : [];
    if (!teamId || !adds.length) continue;
    for (const added of adds) {
      const playerId = String(added.playerId ?? "");
      if (!playerId) continue;
      const post = (playerWeeks.get(playerId) ?? []).filter(r => String(r.teamId) === teamId && Number(r.week) <= previousWeek).sort((a,b) => Number(a.week)-Number(b.week)).slice(-3);
      if (post.length < 2) continue;
      const avg = post.reduce((s,r) => s + Number(r.points), 0) / post.length;
      if (avg >= 15) {
        candidates.push({
          type: "pickup_payoff",
          priority: round(avg * post.length),
          team: String(post[post.length - 1].teamName),
          player: String(added.name ?? playerId),
          evidence: "After being acquired, " + String(added.name ?? playerId) + " scored " + post.map(r => round(Number(r.points))).join(", ") + " across " + post.length + " weeks, averaging " + round(avg) + ".",
        });
      }
    }
  }
  return candidates;
}

function buildNarrativeContext(
  history: Json[],
  standings: Json[],
  teams: Json[],
  previousWeek: number,
  transactions: Json[] = [],
  useManagerNames = false,
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
      teamName: useManagerNames ? String(team.managerName ?? "Unknown Manager") : historicalTeamName(finals, id, previousWeek, String(team.name ?? "Unknown Team")),
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
      type: "upset", priority: round(50 - prob), team: useManagerNames ? String(teamById.get(String(winner.teamId))?.managerName ?? "Unknown Manager") : String(winner.teamName ?? teamById.get(String(winner.teamId))?.name ?? "Unknown Team"),
      evidence: "Won despite a " + round(prob) + "% pre-matchup win probability."
    });
    else if (Number.isFinite(projectedDiff) && projectedDiff < 0) candidates.push({
      type: "upset", priority: round(-projectedDiff), team: useManagerNames ? String(teamById.get(String(winner.teamId))?.managerName ?? "Unknown Manager") : String(winner.teamName ?? teamById.get(String(winner.teamId))?.name ?? "Unknown Team"),
      evidence: "Won while projected to score " + round(-projectedDiff) + " fewer points."
    });

    if (margin >= 30) candidates.push({
      type: "blowout", priority: round(margin), team: String(winner.teamName ?? teamById.get(String(winner.teamId))?.name ?? "Unknown Team"),
      evidence: "Won by " + round(margin) + " points."
    });
    if (margin <= 5) candidates.push({
      type: "close_game", priority: round(5 - margin), team: String(winner.teamName ?? teamById.get(String(winner.teamId))?.name ?? "Unknown Team"),
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
          type: "bench_mistake", priority: round(gain), team: useManagerNames ? String(teamById.get(id)?.managerName ?? "Unknown Manager") : String(side.teamName ?? teamById.get(id)?.name ?? "Unknown Team"),
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

  candidates.push(...buildMultiWeekStoryCandidates(finals, transactions, teams, previousWeek, useManagerNames));
  candidates.sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
  return { teamTrends, storyCandidates: candidates.slice(0, 30) };
}

function buildHistoricalStandings(history: Json[], teams: Json[], throughWeek: number, useManagerNames = false): Json[] {
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
        teamName: useManagerNames ? String(team.managerName ?? "Unknown Manager") : historicalTeamName(history, id, throughWeek, String(team.name ?? "Unknown Team")),
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

function previewMatchup(matchup: Json, teamById: Map<string, Json>, useManagerNames = false): Json {
  const previewSide = (side: Json) => {
    const team = teamById.get(String(side.teamId)) ?? {};
    const players = Array.isArray(side.players) ? side.players as Json[] : [];
    return {
      teamId: side.teamId,
      teamName: useManagerNames ? String(team.managerName ?? "Unknown Manager") : String(side.teamName ?? team.name),
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

function buildCurrentEventsContext(generatedAt: string): Json {
  const date = new Date(generatedAt);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const holidays: string[] = [];
  if (month === 11 && day >= 20 && day <= 30) holidays.push("Thanksgiving season");
  if (month === 12 && day >= 15 && day <= 31) holidays.push("Christmas/holiday season");
  if (month === 1 && day <= 7) holidays.push("New Year season");
  if (month === 10 && day >= 20 && day <= 31) holidays.push("Halloween season");
  return {
    enabled: process.env.NEWSLETTER_CURRENT_EVENTS_ENABLED === "true",
    date: generatedAt,
    calendarContext: holidays,
    searchContext: "Live web search is not part of the newsletter configuration; use only the supplied calendar context and available fantasy/NFL data.",
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

function geminiRetryDelayMs(response: Response, body: Json, attempt: number): number {
  // Prefer the server's explicit retry guidance when available.
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.max(seconds * 1000, 1000), 5 * 60 * 1000);
    }
  }

  // Gemini commonly returns google.rpc.RetryInfo.retryDelay for 429/503 responses.
  const details = Array.isArray((body.error as Json | undefined)?.details)
    ? ((body.error as Json).details as Json[])
    : [];
  const retryInfo = details.find(
    (detail) =>
      typeof detail["@type"] === "string" &&
      detail["@type"].includes("RetryInfo") &&
      typeof detail.retryDelay === "string",
  );
  if (retryInfo) {
    const match = String(retryInfo.retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
    if (match) {
      return Math.min(Math.max(Number(match[1]) * 1000, 1000), 5 * 60 * 1000);
    }
  }

  // Free-tier 429s often need a full minute to reset; 503s benefit from
  // progressively longer backoff when the model is under heavy demand.
  const baseMs = response.status === 429 ? 60_000 : 30_000;
  const exponentialMs = baseMs * 2 ** (attempt - 1);
  const jitterMs = Math.floor(Math.random() * 5_000);
  return Math.min(exponentialMs + jitterMs, 5 * 60 * 1000);
}

async function generateWithGemini(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ text: string; sources: Source[] }> {
  // Gemini free-tier capacity/rate-limit errors can persist for several minutes.
  // Seven attempts gives transient 429/503 responses enough time to recover.
  const maxAttempts = 7;
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        }),
      },
    );

    const body = (await response.json()) as Json;
    if (response.ok) {
      const text = extractGeminiText(body);
      if (!text) throw new Error("Gemini returned no newsletter text.");
      return { text, sources: uniqueSources(collectSources(body)) };
    }

    if (!retryableStatuses.has(response.status) || attempt === maxAttempts) {
      throw new Error(
        `Gemini newsletter generation failed (${response.status}): ${JSON.stringify(body).slice(0, 1000)}`,
      );
    }

    const delayMs = geminiRetryDelayMs(response, body, attempt);
    console.log(
      `[newsletter] Gemini returned ${response.status}; retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt + 1}/${maxAttempts})...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Gemini newsletter generation exhausted all retry attempts.");
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
    .map((matchup) => matchupWithSignals(matchup, teamById, isBackfill));
  const upcomingMatchups = isBackfill
    ? matchupsHistory
        .filter((matchup) => Number(matchup.week) === upcomingWeek)
        .map((matchup) => previewMatchup(matchup, teamById, isBackfill))
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
      standings: isBackfill ? buildHistoricalStandings(matchupsHistory, teams, previousWeek, isBackfill) : standings,
      superlatives: previousSuperlatives,
      transactions: previousWeekTransactions,
      allTransactionsThroughWeek: transactions,
    },
    upcomingWeek: {
      week: upcomingWeek,
      matchups: upcomingMatchups,
      rosters,
    },
    currentEvents: buildCurrentEventsContext(generatedAt),
    teams: isBackfill
      ? teams.map((team) => ({ ...team, name: isBackfill ? String(team.managerName ?? "Unknown Manager") : String(team.name ?? "Unknown Team") }))
      : teams,
    narrativeContext: buildNarrativeContext(
      matchupsHistory,
      isBackfill ? buildHistoricalStandings(matchupsHistory, teams, previousWeek) : standings,
      teams,
      previousWeek,
      transactions,
      isBackfill,
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
