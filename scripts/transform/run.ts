import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  League, Team, TeamStanding, Matchup, PlayerScore, Superlative, MatchupSide,
} from "../../src/types/league.js";
import type { Transaction } from "../../src/types/transaction.js";
import { findObjects, recordsWithKey, value } from "../yahoo/client.js";

interface RawData {
  fetchedAt: string;
  gameKey: string;
  leagueKey: string;
  metadata: unknown;
  teams: unknown;
  standings: unknown;
  scoreboards: Record<string, unknown>;
  rosters: Record<string, unknown>;
  transactions: unknown;
}

function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}
function first(node: unknown, key: string): unknown {
  return value(node, key);
}
function child(node: Record<string, unknown>, key: string): unknown {
  return node[key];
}
function nestedNumber(node: unknown, key: string): number {
  return num(first(node, key));
}
function findByKey(node: unknown, key: string, wanted: string): Record<string, unknown> | null {
  return findObjects(node, key).find((x) => str(x[key]) === wanted) ?? null;
}

function parseTeams(raw: unknown): Team[] {
  const teams = recordsWithKey(raw, "team_key");
  const seen = new Set<string>();
  return teams.flatMap((team) => {
    const teamId = str(team.team_id || team.team_key);
    if (!teamId || seen.has(teamId)) return [];
    seen.add(teamId);
    const logos = findObjects(team, "team_logo");
    const logo = logos.find((x) => str(x.size) === "large") || logos[0];
    const managers = findObjects(team, "manager");
    const manager = managers[0];
    return [{
      teamId,
      name: str(team.name, `Team ${teamId}`),
      iconUrl: logo ? str(logo.url, "") || null : null,
      managerName: manager ? str(manager.nickname || manager.name || manager.manager_name, "") || undefined : undefined,
      managerId: manager ? str(manager.manager_id || manager.guid, "") || null : null,
      divisionId: str(team.division_id, "") || null,
      divisionName: str(team.division_name, "") || null,
    }];
  });
}

function parseStandings(raw: unknown, teams: Team[], currentWeek: number): TeamStanding[] {
  const teamObjects = recordsWithKey(raw, "team_key");
  const seen = new Set<string>();
  const result: TeamStanding[] = [];
  for (const team of teamObjects) {
    const teamId = str(team.team_id || team.team_key);
    if (!teamId || seen.has(teamId)) continue;
    const standing = findObjects(team, "team_standings")[0] || team;
    const outcomes = findObjects(standing, "outcome_totals")[0] || standing;
    const streak = findObjects(standing, "streak")[0];
    const wins = num(outcomes?.wins), losses = num(outcomes?.losses), ties = num(outcomes?.ties);
    const pct = num(outcomes?.percentage, wins + losses + ties ? wins / (wins + losses + ties) : 0);
    const playoffStatus = bool(team.clinched_playoffs)
      ? "clinched"
      : currentWeek < 1 ? "unknown"
      : "unknown";
    seen.add(teamId);
    result.push({
      teamId,
      rank: num(standing?.rank, result.length + 1),
      wins, losses, ties,
      pointsFor: num(standing?.points_for),
      pointsAgainst: num(standing?.points_against),
      winPct: pct,
      streak: {
        type: str(streak?.type).toLowerCase().startsWith("w") ? "W" : str(streak?.type).toLowerCase().startsWith("t") ? "T" : "L",
        count: num(streak?.value),
      },
      playoffStatus,
      divisionId: str(standing?.division_id, "") || null,
    });
  }
  return result.sort((a, b) => a.rank - b.rank);
}

function parsePlayerScores(raw: unknown): PlayerScore[] {
  const players = recordsWithKey(raw, "player_key");
  const seen = new Set<string>();
  return players.flatMap((p) => {
    const playerId = str(p.player_id || p.player_key);
    if (!playerId || seen.has(playerId)) return [];
    seen.add(playerId);
    const selected = findObjects(p, "selected_position")[0];
    const points = findObjects(p, "player_points")[0];
    const nameObj = findObjects(p, "name")[0];
    const name = str(nameObj?.full || p.full_name || p.name, `Player ${playerId}`);
    const slot = str(selected?.position || p.selected_position || p.position, "BN");
    const gameStatus = str(p.status, "").toLowerCase().includes("post") ? "final"
      : str(p.status, "").toLowerCase().includes("in") ? "in_progress"
      : undefined;
    return [{
      playerId,
      name,
      slot,
      nflTeam: str(p.editorial_team_abbr, "") || undefined,
      opponent: str(p.opponent, "") || undefined,
      points: num(points?.total, num(p.points)),
      projectedPoints: num(findObjects(p, "player_projected_points")[0]?.total, undefined as never),
      isStarter: !["BN", "IR"].includes(slot),
      gameStatus,
    }];
  });
}

function parseMatchups(raw: unknown, season: number): Matchup[] {
  return findObjects(raw, "matchup").flatMap((m, index) => {
    const teams = recordsWithKey(m, "team_key").filter((x) => x.team_key);
    const unique = new Map<string, Record<string, unknown>>();
    for (const t of teams) unique.set(str(t.team_key), t);
    const sides = [...unique.values()].slice(0, 2);
    if (sides.length !== 2) return [];
    const week = num(m.week);
    const statusRaw = str(m.status).toLowerCase();
    const status = statusRaw.includes("post") || statusRaw.includes("final") ? "final"
      : statusRaw.includes("midevent") || statusRaw.includes("inprogress") ? "live"
      : "upcoming";
    const makeSide = (t: Record<string, unknown>): MatchupSide => {
      const pts = findObjects(t, "team_points")[0];
      const proj = findObjects(t, "team_projected_points")[0];
      return {
        teamId: str(t.team_id || t.team_key),
        score: num(pts?.total),
        projectedScore: proj ? num(proj.total) : undefined,
        winProbability: t.win_probability === undefined ? undefined : num(t.win_probability) * 100,
        players: [],
      };
    };
    const winner = str(m.winner_team_key, "") || null;
    const id = `${season}-${week}-${sides.map((s) => str(s.team_id || s.team_key)).sort().join("-")}-${index}`;
    return [{
      matchupId: id,
      season,
      week,
      status,
      home: makeSide(sides[0]),
      away: makeSide(sides[1]),
      winnerTeamId: winner ? str(winner.split(".t.").pop()) : null,
      isPlayoffs: bool(m.is_playoffs),
      playoffRound: bool(m.is_consolation) ? "consolation" : bool(m.is_playoffs) ? "playoffs" : null,
    }];
  });
}

function parseTransactions(raw: unknown): Transaction[] {
  return recordsWithKey(raw, "transaction_key").flatMap((t) => {
    const transactionId = str(t.transaction_key);
    if (!transactionId) return [];
    const typeRaw = str(t.type, "add/drop").toLowerCase();
    const type: Transaction["type"] =
      typeRaw === "add" ? "add" :
      typeRaw === "drop" ? "drop" :
      typeRaw === "waiver" ? "waiver" :
      typeRaw === "trade" || typeRaw === "pending_trade" ? "trade" :
      "commissioner";
    const playersAdded = [];
    const playersDropped = [];
    for (const p of recordsWithKey(t, "player_key")) {
      const data = findObjects(p, "transaction_data")[0] || {};
      const player = {
        playerId: str(p.player_id || p.player_key),
        name: str(findObjects(p, "name")[0]?.full || p.name, "Unknown player"),
        nflTeam: str(p.editorial_team_abbr, "") || undefined,
      };
      const playerType = str(data.type || p.type, "").toLowerCase();
      if (playerType === "drop") playersDropped.push(player);
      else playersAdded.push(player);
    }
    const teamKey = str(value(t, "destination_team_key") || "", "")
      || str(value(t, "source_team_key") || "", "");
    return [{
      transactionId,
      timestamp: new Date(num(t.timestamp) * 1000).toISOString(),
      type,
      teamId: teamKey.includes(".t.") ? teamKey.split(".t.")[1] : teamKey,
      playersAdded,
      playersDropped,
      relatedTeamId: null,
      faabAmount: num(t.faab_bid, NaN),
      note: null,
    }];
  });
}

function makeSuperlatives(matchups: Matchup[], season: number): Superlative[] {
  const completed = matchups.filter((m) => m.status === "final");
  const result: Superlative[] = [];
  const highest = [...completed].sort((a,b) => Math.max(b.home.score,b.away.score)-Math.max(a.home.score,a.away.score))[0];
  if (highest) {
    const side = highest.home.score >= highest.away.score ? highest.home : highest.away;
    result.push({ id:"highest-score", emoji:"🔥", title:"Highest Score", description:"Highest team score in the fetched season", teamId:side.teamId, value:side.score.toFixed(2), week:highest.week, season, matchupId:highest.matchupId });
  }
  const lowest = [...completed].sort((a,b) => Math.min(a.home.score,a.away.score)-Math.min(b.home.score,b.away.score))[0];
  if (lowest) {
    const side = lowest.home.score <= lowest.away.score ? lowest.home : lowest.away;
    result.push({ id:"lowest-score", emoji:"🧊", title:"Lowest Score", description:"Lowest team score in the fetched season", teamId:side.teamId, value:side.score.toFixed(2), week:lowest.week, season, matchupId:lowest.matchupId });
  }
  return result;
}

function parseRosterForTeam(raw: unknown, teamId: string): PlayerScore[] {
  return parsePlayerScores(raw);
}

async function main() {
  const raw = JSON.parse(await readFile(".cache/yahoo/raw.json", "utf8")) as RawData;
  const metadata = raw.metadata;
  const season = num(first(metadata, "season"), Number(process.env.YAHOO_SEASON || new Date().getFullYear()));
  const currentWeek = num(first(metadata, "current_week"), 1);
  const teams = parseTeams(raw.teams);
  const standings = parseStandings(raw.standings, teams, currentWeek);

  const matchupsByWeek = Object.entries(raw.scoreboards).flatMap(([week, body]) =>
    parseMatchups(body, season).map((m) => ({ ...m, week: Number(week) })),
  );
  const deduped = [...new Map(matchupsByWeek.map((m) => [m.matchupId, m])).values()];

  const rosters = new Map<string, PlayerScore[]>();
  for (const [teamKey, body] of Object.entries(raw.rosters)) {
    const teamId = teamKey.split(".t.")[1] || teamKey;
    rosters.set(teamId, parseRosterForTeam(body, teamId));
  }

  const currentMatchups = deduped.filter((m) => m.week === currentWeek).map((m) => ({
    ...m,
    home: { ...m.home, players: rosters.get(m.home.teamId) || [] },
    away: { ...m.away, players: rosters.get(m.away.teamId) || [] },
  }));

  const league: League = {
    leagueId: str(first(metadata, "league_id"), raw.leagueKey.split(".l.").pop() || raw.leagueKey),
    gameId: raw.gameKey,
    season,
    name: str(first(metadata, "name"), "The League"),
    numTeams: num(first(metadata, "num_teams"), teams.length),
    currentWeek,
    completedWeeks: Array.from({ length: Math.max(0, currentWeek - 1) }, (_, i) => i + 1),
    timezone: str(first(metadata, "timezone"), "America/Chicago"),
    isMockData: false,
    lastUpdatedAt: raw.fetchedAt,
  };

  const history = deduped.map((m) => ({ ...m, home: { ...m.home, players: [] }, away: { ...m.away, players: [] } }));
  const transactions = parseTransactions(raw.transactions);
  const superlatives = makeSuperlatives(deduped, season);

  await mkdir("data/current", { recursive: true });
  await mkdir("data/historical", { recursive: true });
  await writeFile("data/current/league.json", JSON.stringify(league, null, 2));
  await writeFile("data/current/teams.json", JSON.stringify(teams, null, 2));
  await writeFile("data/current/standings.json", JSON.stringify(standings, null, 2));
  await writeFile("data/current/matchups-current.json", JSON.stringify(currentMatchups, null, 2));
  await writeFile("data/current/matchups-history.json", JSON.stringify(history, null, 2));
  await writeFile("data/current/superlatives-current.json", JSON.stringify(superlatives, null, 2));
  await writeFile("data/current/transactions.json", JSON.stringify(transactions, null, 2));
  await writeFile("data/current/manager-profiles.json", JSON.stringify([], null, 2));

  for (const week of league.completedWeeks) {
    await writeFile(`data/historical/${season}-week-${week}.json`,
      JSON.stringify(history.filter((m) => m.week === week), null, 2));
  }

  console.log(`[generate] wrote real Yahoo data for ${league.name}, week ${currentWeek}`);
}

main().catch((error) => {
  console.error("[generate] failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
