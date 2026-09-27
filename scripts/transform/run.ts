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

function parseStandings(raw: unknown): TeamStanding[] {
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
    const playoffStatus = bool(team.clinched_playoffs) ? "clinched" : "unknown";
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
    const slot = str(selected?.position || p.selected_position || p.slot, "BN");
    const rawActualPosition = first(p, "display_position") || first(p, "position") || first(p, "primary_position");
    const actualPosition = str(rawActualPosition, "") || undefined;
    const gameStatus = str(p.status, "").toLowerCase().includes("post") ? "final"
      : str(p.status, "").toLowerCase().includes("in") ? "in_progress"
      : undefined;
    const projected = findObjects(p, "player_projected_points")[0]?.total;
    return [{
      playerId,
      name,
      slot,
      actualPosition,
      nflTeam: str(p.editorial_team_abbr, "") || undefined,
      opponent: str(p.opponent, "") || undefined,
      points: num(points?.total, num(p.points)),
      projectedPoints: projected === undefined ? undefined : num(projected),
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

function award(
  week: number,
  season: number,
  key: string,
  emoji: string,
  title: string,
  description: string,
  teamId: string,
  value: string,
  matchupId?: string,
): Superlative {
  return { id: `sup-${key}-w${week}`, emoji, title, description, teamId, value, week, season, matchupId };
}

function eligibleStarterSlots(player: PlayerScore): string[] {
  const position = String(player.actualPosition || "").toUpperCase();
  if (position === "QB") return ["QB"];
  if (position === "RB") return ["RB", "FLEX"];
  if (position === "WR") return ["WR", "FLEX"];
  if (position === "TE") return ["TE", "FLEX"];
  return [];
}

function findDonkey(matchups: Matchup[], week: number, season: number): Superlative | null {
  const finalMatchups = matchups.filter((m) => m.week === week && m.status === "final");
  let best: { teamId: string; matchupId: string; player: PlayerScore; gain: number; wouldWinBy: number } | null = null;

  for (const matchup of finalMatchups) {
    for (const [own, opponent] of [[matchup.home, matchup.away], [matchup.away, matchup.home]]) {
      if (own.score >= opponent.score) continue;

      const starters = own.players.filter((p) => p.isStarter && !["BN", "IR"].includes(String(p.slot).toUpperCase()));
      const bench = own.players.filter((p) => !p.isStarter || ["BN", "IR"].includes(String(p.slot).toUpperCase()));

      for (const player of bench) {
        const slots = eligibleStarterSlots(player);
        if (slots.length === 0) continue;
        const replaceable = starters.filter((starter) => slots.includes(String(starter.slot).toUpperCase()));
        if (replaceable.length === 0) continue;

        const replaced = replaceable.reduce((lowest, current) => current.points < lowest.points ? current : lowest);
        const gain = player.points - replaced.points;
        const wouldWinBy = own.score + gain - opponent.score;
        if (gain <= 0 || wouldWinBy <= 0) continue;

        if (!best || wouldWinBy > best.wouldWinBy || (wouldWinBy === best.wouldWinBy && gain > best.gain)) {
          best = { teamId: own.teamId, matchupId: matchup.matchupId, player, gain, wouldWinBy };
        }
      }
    }
  }

  if (!best) return null;
  return award(
    week,
    season,
    "donkey-of-the-week",
    "🫏",
    "Donkey of the Week",
    "A losing team had a bench player who was eligible for a starter slot, scored more than the lowest-scoring eligible starter, and the extra points would have turned the loss into a win. Only completed matchups count; if nobody qualifies, no Donkey is awarded.",
    best.teamId,
    `${best.player.name}: +${best.gain.toFixed(1)} pts → would win by ${best.wouldWinBy.toFixed(1)}`,
    best.matchupId,
  );
}

function makeSuperlatives(matchups: Matchup[], season: number): Superlative[] {
  const completedWeeks = [...new Set(matchups.filter((m) => m.status === "final").map((m) => m.week))].sort((a, b) => a - b);
  const result: Superlative[] = [];

  for (const week of completedWeeks) {
    const completed = matchups.filter((m) => m.status === "final" && m.week === week);
    const sides = completed.flatMap((m) => [
      { side: m.home, opponent: m.away, matchup: m },
      { side: m.away, opponent: m.home, matchup: m },
    ]);
    const winners = sides.filter(({ side, matchup }) => matchup.winnerTeamId === side.teamId);
    const losers = sides.filter(({ side, matchup }) => matchup.winnerTeamId && matchup.winnerTeamId !== side.teamId);

    const highest = [...sides].sort((a, b) => b.side.score - a.side.score)[0];
    if (highest) result.push(award(week, season, "team-of-the-week", "🔥", "Team of the Week", "Highest team score in the completed week.", highest.side.teamId, `${highest.side.score.toFixed(1)} pts`, highest.matchup.matchupId));

    const lowest = [...sides].sort((a, b) => a.side.score - b.side.score)[0];
    if (lowest) result.push(award(week, season, "dumpster-fire", "💩", "Dumpster Fire of the Week", "Lowest team score in the completed week.", lowest.side.teamId, `${lowest.side.score.toFixed(1)} pts`, lowest.matchup.matchupId));

    const pain = [...losers].sort((a, b) => b.side.score - a.side.score)[0];
    if (pain) result.push(award(week, season, "pain-of-week", "🫠", "Pain of the Week", "Highest-scoring team that still lost its matchup.", pain.side.teamId, `${pain.side.score.toFixed(1)} pts, still lost`, pain.matchup.matchupId));

    const upset = [...winners]
      .filter(({ side }) => side.winProbability != null)
      .sort((a, b) => (a.side.winProbability ?? 101) - (b.side.winProbability ?? 101))[0];
    if (upset) result.push(award(week, season, "biggest-upset", "🎰", "Biggest Upset", "Winner with the lowest pre-matchup Yahoo win probability.", upset.side.teamId, `${(upset.side.winProbability ?? 0).toFixed(0)}% win prob → W`, upset.matchup.matchupId));

    const choke = [...sides]
      .filter(({ side }) => side.projectedScore != null)
      .sort((a, b) => ((a.side.score - (a.side.projectedScore ?? a.side.score)) - (b.side.score - (b.side.projectedScore ?? b.side.score))))[0];
    if (choke) result.push(award(week, season, "biggest-choke", "😬", "Biggest Choke", "Largest negative difference between actual score and pre-matchup projected score.", choke.side.teamId, `${(choke.side.score - (choke.side.projectedScore ?? choke.side.score)).toFixed(1)} vs projection`, choke.matchup.matchupId));

    const iceCold = [...winners].sort((a, b) => a.side.score - b.side.score)[0];
    if (iceCold) result.push(award(week, season, "ice-cold", "🧊", "Ice Cold", "Lowest score among the week's winners.", iceCold.side.teamId, `${iceCold.side.score.toFixed(1)} pts, still won`, iceCold.matchup.matchupId));

    const statement = [...winners]
      .map((entry) => ({ ...entry, margin: entry.side.score - entry.opponent.score }))
      .sort((a, b) => b.margin - a.margin)[0];
    if (statement) result.push(award(week, season, "statement-win", "👑", "Statement Win", "Largest margin of victory in the completed week.", statement.side.teamId, `won by ${statement.margin.toFixed(1)}`, statement.matchup.matchupId));

    const brickWall = [...sides].sort((a, b) => a.opponent.score - b.opponent.score)[0];
    if (brickWall) result.push(award(week, season, "brick-wall", "🧱", "Brick Wall", "Fewest points allowed by a team in the completed week.", brickWall.side.teamId, `${brickWall.opponent.score.toFixed(1)} pts allowed`, brickWall.matchup.matchupId));

    const priorMatchups = matchups.filter((m) => m.status === "final" && m.week < week);
    const priorScores = new Map<string, number[]>();
    for (const m of priorMatchups) {
      for (const side of [m.home, m.away]) {
        const scores = priorScores.get(side.teamId) ?? [];
        scores.push(side.score);
        priorScores.set(side.teamId, scores);
      }
    }

    const explosion = [...sides]
      .map((entry) => {
        const scores = priorScores.get(entry.side.teamId) ?? [];
        const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
        return avg == null ? null : { ...entry, delta: entry.side.score - avg, avg };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.delta - a.delta)[0];
    if (explosion) result.push(award(week, season, "explosion", "💣", "Explosion", "Largest jump above the team's average score from prior completed weeks.", explosion.side.teamId, `+${explosion.delta.toFixed(1)} vs season avg`, explosion.matchup.matchupId));

    const previousWeekScores = new Map<string, number>();
    for (const m of matchups.filter((m) => m.status === "final" && m.week === week - 1)) {
      previousWeekScores.set(m.home.teamId, m.home.score);
      previousWeekScores.set(m.away.teamId, m.away.score);
    }
    const changes = [...sides]
      .map((entry) => previousWeekScores.has(entry.side.teamId) ? ({ ...entry, delta: entry.side.score - previousWeekScores.get(entry.side.teamId)! }) : null)
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const up = [...changes].sort((a, b) => b.delta - a.delta)[0];
    const down = [...changes].sort((a, b) => a.delta - b.delta)[0];
    if (up) result.push(award(week, season, "trending-up", "📈", "Trending Up", "Biggest improvement over the team's immediately preceding completed-week score.", up.side.teamId, `+${up.delta.toFixed(1)} vs last week`, up.matchup.matchupId));
    if (down) result.push(award(week, season, "trending-down", "📉", "Trending Down", "Biggest decline versus the team's immediately preceding completed-week score.", down.side.teamId, `${down.delta.toFixed(1)} vs last week`, down.matchup.matchupId));

    const donkey = findDonkey(matchups, week, season);
    if (donkey) result.push(donkey);
  }

  return result;
}

function parseRosterForTeam(raw: unknown): PlayerScore[] {
  return parsePlayerScores(raw);
}

async function main() {
  const raw = JSON.parse(await readFile(".cache/yahoo/raw.json", "utf8")) as RawData;
  const metadata = raw.metadata;
  const season = num(first(metadata, "season"), Number(process.env.YAHOO_SEASON || new Date().getFullYear()));
  const currentWeek = num(first(metadata, "current_week"), 1);
  const teams = parseTeams(raw.teams);
  const standings = parseStandings(raw.standings);

  const matchupsByWeek = Object.entries(raw.scoreboards).flatMap(([week, body]) =>
    parseMatchups(body, season).map((m) => ({ ...m, week: Number(week) })),
  );
  const deduped = [...new Map(matchupsByWeek.map((m) => [m.matchupId, m])).values()];

  const rosterByWeekAndTeam = new Map<string, PlayerScore[]>();
  for (const [key, body] of Object.entries(raw.rosters)) {
    const [week, teamKey] = key.split("|");
    const teamId = teamKey?.split(".t.")[1] || teamKey;
    if (week && teamId) rosterByWeekAndTeam.set(`${week}|${teamId}`, parseRosterForTeam(body));
  }

  const history = deduped.map((m) => ({
    ...m,
    home: { ...m.home, players: rosterByWeekAndTeam.get(`${m.week}|${m.home.teamId}`) || [] },
    away: { ...m.away, players: rosterByWeekAndTeam.get(`${m.week}|${m.away.teamId}`) || [] },
  }));

  const currentMatchups = history.filter((m) => m.week === currentWeek);
  const league: League = {
    leagueId: str(first(metadata, "league_id"), raw.leagueKey.split(".l.").pop() || raw.leagueKey),
    gameId: raw.gameKey,
    season,
    name: str(first(metadata, "name"), "The League"),
    numTeams: num(first(metadata, "num_teams"), teams.length),
    currentWeek,
    completedWeeks: [...new Set(history.filter((m) => m.status === "final").map((m) => m.week))].sort((a, b) => a - b),
    timezone: str(first(metadata, "timezone"), "America/Chicago"),
    isMockData: false,
    lastUpdatedAt: raw.fetchedAt,
  };

  const transactions = parseTransactions(raw.transactions);
  const superlativeHistory = makeSuperlatives(history, season);
  const superlatives = superlativeHistory.filter((s) => s.week === currentWeek);

  await mkdir("data/current", { recursive: true });
  await mkdir("data/historical", { recursive: true });
  await writeFile("data/current/league.json", JSON.stringify(league, null, 2));
  await writeFile("data/current/teams.json", JSON.stringify(teams, null, 2));
  await writeFile("data/current/standings.json", JSON.stringify(standings, null, 2));
  await writeFile("data/current/matchups-current.json", JSON.stringify(currentMatchups, null, 2));
  await writeFile("data/current/matchups-history.json", JSON.stringify(history, null, 2));
  await writeFile("data/current/superlatives-current.json", JSON.stringify(superlatives, null, 2));
  await writeFile("data/current/superlatives-history.json", JSON.stringify(superlativeHistory, null, 2));
  await writeFile("data/current/transactions.json", JSON.stringify(transactions, null, 2));
  await writeFile("data/current/manager-profiles.json", JSON.stringify([], null, 2));

  for (const week of league.completedWeeks) {
    await writeFile(
      `data/historical/${season}-week-${week}.json`,
      JSON.stringify(history.filter((m) => m.week === week), null, 2),
    );
  }

  console.log(`[generate] wrote real Yahoo data for ${league.name}, week ${currentWeek}, with ${league.completedWeeks.length} completed weekly snapshots and ${superlativeHistory.length} superlatives`);
}

main().catch((error) => {
  console.error("[generate] failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
