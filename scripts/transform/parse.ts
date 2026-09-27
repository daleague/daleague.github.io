import type {
  League,
  Matchup,
  MatchupSide,
  PlayerScore,
  Superlative,
  Team,
  TeamStanding,
} from "../../src/types/league.js";
import type { Transaction, TransactionPlayer, TransactionType } from "../../src/types/transaction.js";
import {
  findObjects,
  mergeYahooRecord,
  nestedTotal,
  normalizeTeamId,
  pointsFrom,
  recordsWithKey,
  richerRecord,
  value,
} from "../yahoo/yahooJson.js";

export interface RawData {
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
  if (v == null) return fallback;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
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

function winProbPct(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n <= 1 ? Math.round(n * 1000) / 10 : n;
}

export function parseTeams(raw: unknown): Team[] {
  const teams = recordsWithKey(raw, "team_key");
  const seen = new Map<string, Team>();
  for (const team of teams) {
    const teamId = normalizeTeamId(team.team_key, team.team_id);
    if (!teamId) continue;
    const logos = findObjects(team, "team_logo");
    const logo = logos.find((x) => str(x.size) === "large") || logos[0];
    const managers = findObjects(team, "manager");
    const manager = managers[0];
    const parsed: Team = {
      teamId,
      name: str(team.name, `Team ${teamId}`),
      iconUrl: logo ? str(logo.url, "") || null : null,
      managerName: manager ? str(manager.nickname || manager.name || manager.manager_name, "") || undefined : undefined,
      managerId: manager ? str(manager.manager_id || manager.guid, "") || null : null,
      divisionId: str(team.division_id, "") || null,
      divisionName: str(team.division_name, "") || null,
    };
    const prev = seen.get(teamId);
    if (!prev || parsed.name !== `Team ${teamId}` || (parsed.iconUrl && !prev.iconUrl)) {
      seen.set(teamId, { ...prev, ...parsed, name: parsed.name !== `Team ${teamId}` ? parsed.name : prev?.name ?? parsed.name });
    }
  }
  return [...seen.values()];
}

export function parseStandings(raw: unknown): TeamStanding[] {
  const teamObjects = recordsWithKey(raw, "team_key");
  const byId = new Map<string, TeamStanding>();
  for (const team of teamObjects) {
    const teamId = normalizeTeamId(team.team_key, team.team_id);
    if (!teamId) continue;
    const standingNode = findObjects(team, "team_standings")[0] || (team.team_standings ? mergeYahooRecord(team.team_standings) : team);
    const standing = mergeYahooRecord(standingNode);
    const outcomes = mergeYahooRecord(findObjects(standing, "outcome_totals")[0] || standing.outcome_totals || standing);
    const streakNode = findObjects(standing, "streak")[0] || standing.streak;
    const streak = mergeYahooRecord(streakNode);
    const wins = num(outcomes.wins ?? first(outcomes, "wins"));
    const losses = num(outcomes.losses ?? first(outcomes, "losses"));
    const ties = num(outcomes.ties ?? first(outcomes, "ties"));
    const pct = num(
      outcomes.percentage ?? first(outcomes, "percentage"),
      wins + losses + ties ? wins / (wins + losses + ties) : 0,
    );
    const pointsFor = num(standing.points_for ?? first(standing, "points_for"));
    const pointsAgainst = num(standing.points_against ?? first(standing, "points_against"));
    const rank = num(standing.rank ?? first(standing, "rank"), 0);
    const streakTypeRaw = str(streak.type || first(streak, "type")).toLowerCase();
    const parsed: TeamStanding = {
      teamId,
      rank,
      wins,
      losses,
      ties,
      pointsFor,
      pointsAgainst,
      winPct: pct,
      streak: {
        type: streakTypeRaw.startsWith("w") ? "W" : streakTypeRaw.startsWith("t") ? "T" : "L",
        count: num(streak.value ?? first(streak, "value")),
      },
      playoffStatus: bool(team.clinched_playoffs) ? "clinched" : "unknown",
      divisionId: str(standing.division_id ?? team.division_id, "") || null,
    };
    const prev = byId.get(teamId);
    if (!prev || parsed.wins + parsed.losses + parsed.pointsFor >= prev.wins + prev.losses + prev.pointsFor) {
      byId.set(teamId, parsed);
    }
  }
  const result = [...byId.values()];
  const ranked = result.every((s) => s.rank > 0)
    ? result.sort((a, b) => a.rank - b.rank)
    : result;
  return ranked;
}

function slotOf(player: Record<string, unknown>): string {
  const selected = mergeYahooRecord(findObjects(player, "selected_position")[0] || player.selected_position);
  const position = str(selected.position || first(selected, "position"));
  if (position) return position.toUpperCase() === "W/R/T" ? "W/R/T" : position;
  return "BN";
}

export function parsePlayerScores(raw: unknown): PlayerScore[] {
  const players = recordsWithKey(raw, "player_key");
  const byId = new Map<string, PlayerScore>();
  for (const p of players) {
    const playerId = str(p.player_id || String(p.player_key).split(".p.").pop() || p.player_key);
    if (!playerId) continue;
    const nameObj = findObjects(p, "name")[0];
    const name = str(nameObj?.full || p.full_name, "") || str(typeof p.name === "string" ? p.name : "", `Player ${playerId}`);
    const slot = slotOf(p);
    const actual = str(first(p, "display_position") || first(p, "primary_position") || "", "") || undefined;
    const points = pointsFrom(p, "player_points");
    const headshot = findObjects(p, "headshot")[0] || (p.headshot && typeof p.headshot === "object" ? mergeYahooRecord(p.headshot) : undefined);
    const headshotUrl = str(headshot?.url || p.headshot_url, "") || undefined;
    const statusRaw = str(p.status, "").toLowerCase();
    const gameStatus = statusRaw.includes("post") || statusRaw === "final"
      ? "final" as const
      : statusRaw.includes("in") || statusRaw.includes("live")
        ? "in_progress" as const
        : undefined;
    const parsed: PlayerScore = {
      playerId,
      name,
      slot,
      actualPosition: actual,
      nflTeam: str(p.editorial_team_abbr, "") || undefined,
      opponent: str(p.opponent, "") || undefined,
      points: points !== 0 ? points : num(p.points),
      headshotUrl,
      isStarter: !["BN", "IR", "IR+", "NA"].includes(slot.toUpperCase()),
      gameStatus,
    };
    const prev = byId.get(playerId);
    if (!prev || parsed.points > prev.points || (parsed.slot !== "BN" && prev.slot === "BN") || (parsed.name !== `Player ${playerId}` && prev.name === `Player ${playerId}`)) {
      byId.set(playerId, { ...prev, ...parsed, slot: parsed.slot !== "BN" ? parsed.slot : prev?.slot ?? parsed.slot });
    }
  }
  return [...byId.values()];
}

export function parseMatchups(raw: unknown, season: number, weekFallback?: number): Matchup[] {
  return findObjects(raw, "matchup").flatMap((m, index) => {
    const matchup = mergeYahooRecord(m);
    const teams = recordsWithKey(m, "team_key").filter((x) => x.team_key || x.team_id);
    const unique = new Map<string, Record<string, unknown>>();
    for (const t of teams) {
      const id = normalizeTeamId(t.team_key, t.team_id);
      if (!id) continue;
      unique.set(id, richerRecord(unique.get(id), t));
    }
    const sides = [...unique.values()].slice(0, 2);
    if (sides.length !== 2) return [];
    const week = num(matchup.week ?? first(matchup, "week"), weekFallback ?? 0);
    const statusRaw = str(matchup.status ?? first(matchup, "status")).toLowerCase();
    const status = statusRaw.includes("post") || statusRaw.includes("final")
      ? "final" as const
      : statusRaw.includes("midevent") || statusRaw.includes("inprogress") || statusRaw.includes("live")
        ? "live" as const
        : "upcoming" as const;

    const makeSide = (t: Record<string, unknown>): MatchupSide => {
      const team = mergeYahooRecord(t);
      const projected = nestedTotal(team.team_projected_points) ?? nestedTotal(findObjects(team, "team_projected_points")[0]);
      return {
        teamId: normalizeTeamId(team.team_key, team.team_id),
        score: pointsFrom(team, "team_points"),
        projectedScore: projected,
        winProbability: winProbPct(team.win_probability ?? first(team, "win_probability")),
        players: parsePlayerScores(t),
      };
    };

    const home = makeSide(sides[0]);
    const away = makeSide(sides[1]);
    const winnerKey = str(matchup.winner_team_key ?? first(matchup, "winner_team_key"), "") || null;
    let winnerTeamId = winnerKey ? normalizeTeamId(winnerKey) : null;
    if (!winnerTeamId && status === "final") {
      if (home.score > away.score) winnerTeamId = home.teamId;
      else if (away.score > home.score) winnerTeamId = away.teamId;
    }
    const ids = [home.teamId, away.teamId].sort();
    return [{
      matchupId: `${season}-${week}-${ids[0]}-${ids[1]}-${index}`,
      season,
      week,
      status,
      home,
      away,
      winnerTeamId,
      isPlayoffs: bool(matchup.is_playoffs ?? first(matchup, "is_playoffs")),
      playoffRound: bool(matchup.is_consolation) ? "consolation" : bool(matchup.is_playoffs) ? "playoffs" : null,
    }];
  });
}

function playerFromRecord(p: Record<string, unknown>): TransactionPlayer {
  const nameObj = findObjects(p, "name")[0];
  return {
    playerId: str(p.player_id || String(p.player_key).split(".p.").pop() || p.player_key),
    name: str(nameObj?.full || (typeof p.name === "string" ? p.name : ""), "Unknown player"),
    nflTeam: str(p.editorial_team_abbr, "") || undefined,
  };
}

function mapTransactionType(raw: string, hasAdd: boolean, hasDrop: boolean): TransactionType {
  const t = raw.toLowerCase();
  if (t === "add/drop" || t === "add_drop") return "add/drop";
  if (t === "add") return hasDrop ? "add/drop" : "add";
  if (t === "drop") return hasAdd ? "add/drop" : "drop";
  if (t === "waiver" || t === "waivers") return "waiver";
  if (t === "trade" || t === "pending_trade") return "trade";
  if (hasAdd && hasDrop) return "add/drop";
  if (hasDrop && !hasAdd) return "drop";
  if (hasAdd && !hasDrop) return "add";
  return "commissioner";
}

export function parseTransactions(raw: unknown): Transaction[] {
  return recordsWithKey(raw, "transaction_key").flatMap((t) => {
    const tx = mergeYahooRecord(t);
    const transactionId = str(tx.transaction_key || t.transaction_key);
    if (!transactionId) return [];
    const playersAdded: TransactionPlayer[] = [];
    const playersDropped: TransactionPlayer[] = [];
    let teamId = "";
    let relatedTeamId: string | null = null;

    for (const p of recordsWithKey(t, "player_key")) {
      const data = mergeYahooRecord(findObjects(p, "transaction_data")[0] || p.transaction_data);
      const player = playerFromRecord(p);
      const playerType = str(data.type || p.type, "").toLowerCase();
      const dest = normalizeTeamId(data.destination_team_key, first(data, "destination_team_key"));
      const source = normalizeTeamId(data.source_team_key, first(data, "source_team_key"));
      if (playerType === "drop") {
        playersDropped.push(player);
        if (!teamId) teamId = source || dest;
      } else if (playerType === "add") {
        playersAdded.push(player);
        if (!teamId) teamId = dest || source;
      } else if (source && dest && source !== dest) {
        // trade player moving between teams
        playersAdded.push(player);
        if (!teamId) teamId = dest;
        relatedTeamId = source;
      } else {
        playersAdded.push(player);
        if (!teamId) teamId = dest || source;
      }
    }

    if (!teamId) {
      teamId = normalizeTeamId(
        tx.destination_team_key,
        first(tx, "destination_team_key"),
        tx.source_team_key,
        first(tx, "source_team_key"),
      );
    }

    const typeRaw = str(tx.type ?? t.type, "");
    const type = mapTransactionType(typeRaw, playersAdded.length > 0, playersDropped.length > 0);
    const ts = num(tx.timestamp ?? t.timestamp);
    const faabRaw = tx.faab_bid ?? t.faab_bid;
    const faab = faabRaw == null || faabRaw === "" ? null : num(faabRaw);

    return [{
      transactionId,
      timestamp: ts > 1e12 ? new Date(ts).toISOString() : new Date(ts * 1000).toISOString(),
      type,
      teamId,
      playersAdded,
      playersDropped,
      relatedTeamId,
      faabAmount: faab,
      note: null,
    }];
  });
}

export function winnerOf(matchup: Matchup): string | null {
  if (matchup.winnerTeamId) return normalizeTeamId(matchup.winnerTeamId);
  if (matchup.status !== "final") return null;
  if (matchup.home.score > matchup.away.score) return matchup.home.teamId;
  if (matchup.away.score > matchup.home.score) return matchup.away.teamId;
  return null;
}

export function deriveStandings(teams: Team[], parsed: TeamStanding[], matchups: Matchup[]): TeamStanding[] {
  const useful = parsed.filter((s) => s.wins || s.losses || s.ties || s.pointsFor);
  if (useful.length >= Math.min(teams.length, 2) && useful.some((s) => s.pointsFor || s.wins)) {
    const byId = new Map(parsed.map((s) => [normalizeTeamId(s.teamId), { ...s, teamId: normalizeTeamId(s.teamId) }]));
    return teams
      .map((team, idx) => byId.get(team.teamId) ?? {
        teamId: team.teamId,
        rank: idx + 1,
        wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, winPct: 0,
        streak: { type: "L" as const, count: 0 },
        playoffStatus: "unknown" as const,
        divisionId: team.divisionId ?? null,
      })
      .sort((a, b) => (a.rank || 99) - (b.rank || 99));
  }

  type Acc = { wins: number; losses: number; ties: number; pf: number; pa: number; results: Array<"W" | "L" | "T"> };
  const byId = new Map<string, Acc>();
  for (const team of teams) {
    byId.set(team.teamId, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, results: [] });
  }

  const finals = [...matchups].filter((m) => m.status === "final").sort((a, b) => a.week - b.week);
  for (const m of finals) {
    const home = byId.get(m.home.teamId);
    const away = byId.get(m.away.teamId);
    if (!home || !away) continue;
    home.pf += m.home.score;
    home.pa += m.away.score;
    away.pf += m.away.score;
    away.pa += m.home.score;
    const winner = winnerOf(m);
    if (winner === m.home.teamId) {
      home.wins += 1; away.losses += 1;
      home.results.push("W"); away.results.push("L");
    } else if (winner === m.away.teamId) {
      away.wins += 1; home.losses += 1;
      away.results.push("W"); home.results.push("L");
    } else {
      home.ties += 1; away.ties += 1;
      home.results.push("T"); away.results.push("T");
    }
  }

  const rows: TeamStanding[] = teams.map((team) => {
    const acc = byId.get(team.teamId)!;
    const games = acc.wins + acc.losses + acc.ties;
    let streakType: "W" | "L" | "T" = "L";
    let streakCount = 0;
    for (let i = acc.results.length - 1; i >= 0; i--) {
      if (streakCount === 0) {
        streakType = acc.results[i];
        streakCount = 1;
      } else if (acc.results[i] === streakType) {
        streakCount += 1;
      } else break;
    }
    return {
      teamId: team.teamId,
      rank: 0,
      wins: acc.wins,
      losses: acc.losses,
      ties: acc.ties,
      pointsFor: acc.pf,
      pointsAgainst: acc.pa,
      winPct: games ? (acc.wins + acc.ties * 0.5) / games : 0,
      streak: { type: streakType, count: streakCount },
      playoffStatus: "unknown",
      divisionId: team.divisionId ?? null,
    };
  });

  rows.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor || a.teamId.localeCompare(b.teamId));
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
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
  if (position === "RB") return ["RB", "FLEX", "W/R/T"];
  if (position === "WR") return ["WR", "FLEX", "W/R/T"];
  if (position === "TE") return ["TE", "FLEX", "W/R/T"];
  return [];
}

export function findDonkey(matchups: Matchup[], week: number, season: number): Superlative | null {
  const finalMatchups = matchups.filter((m) => m.week === week && m.status === "final");
  let best: { teamId: string; matchupId: string; player: PlayerScore; gain: number; wouldWinBy: number } | null = null;

  for (const matchup of finalMatchups) {
    for (const [own, opponent] of [[matchup.home, matchup.away], [matchup.away, matchup.home]]) {
      if (own.score >= opponent.score) continue;
      const starters = own.players.filter((p) => p.isStarter && !["BN", "IR", "IR+", "NA"].includes(String(p.slot).toUpperCase()));
      const bench = own.players.filter((p) => !p.isStarter || ["BN", "IR", "IR+", "NA"].includes(String(p.slot).toUpperCase()));

      for (const player of bench) {
        const slots = eligibleStarterSlots(player);
        if (slots.length === 0) continue;
        const replaceable = starters.filter((starter) => slots.includes(String(starter.slot).toUpperCase()));
        if (replaceable.length === 0) continue;
        const replaced = replaceable.reduce((lowest, current) => (current.points < lowest.points ? current : lowest));
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

export function makeSuperlatives(matchups: Matchup[], season: number): Superlative[] {
  const completedWeeks = [...new Set(matchups.filter((m) => m.status === "final").map((m) => m.week))].sort((a, b) => a - b);
  const result: Superlative[] = [];

  for (const week of completedWeeks) {
    const completed = matchups.filter((m) => m.status === "final" && m.week === week);
    const sides = completed.flatMap((m) => [
      { side: m.home, opponent: m.away, matchup: m },
      { side: m.away, opponent: m.home, matchup: m },
    ]);
    if (sides.length === 0) continue;
    if (sides.every(({ side }) => side.score === 0)) continue;

    const winnerId = (m: Matchup) => winnerOf(m);
    const winners = sides.filter(({ side, matchup }) => winnerId(matchup) === side.teamId);
    const losers = sides.filter(({ side, matchup }) => {
      const w = winnerId(matchup);
      return !!w && w !== side.teamId;
    });

    const highest = [...sides].sort((a, b) => b.side.score - a.side.score)[0];
    if (highest) {
      result.push(award(week, season, "team-of-the-week", "🔥", "Team of the Week", "Highest team score in the completed week.", highest.side.teamId, `${highest.side.score.toFixed(1)} pts`, highest.matchup.matchupId));
    }

    const lowest = [...sides].sort((a, b) => a.side.score - b.side.score)[0];
    if (lowest && lowest.side.teamId !== highest?.side.teamId) {
      result.push(award(week, season, "dumpster-fire", "💩", "Dumpster Fire of the Week", "Lowest team score in the completed week.", lowest.side.teamId, `${lowest.side.score.toFixed(1)} pts`, lowest.matchup.matchupId));
    } else if (lowest && lowest.side.score < (highest?.side.score ?? 0)) {
      result.push(award(week, season, "dumpster-fire", "💩", "Dumpster Fire of the Week", "Lowest team score in the completed week.", lowest.side.teamId, `${lowest.side.score.toFixed(1)} pts`, lowest.matchup.matchupId));
    }

    const pain = [...losers].sort((a, b) => b.side.score - a.side.score)[0];
    if (pain) {
      result.push(award(week, season, "pain-of-week", "🫠", "Pain of the Week", "Highest-scoring team that still lost its matchup.", pain.side.teamId, `${pain.side.score.toFixed(1)} pts, still lost`, pain.matchup.matchupId));
    }

    const upset = [...winners]
      .filter(({ side }) => side.winProbability != null)
      .sort((a, b) => (a.side.winProbability ?? 101) - (b.side.winProbability ?? 101))[0];
    if (upset && (upset.side.winProbability ?? 100) < 50) {
      result.push(award(week, season, "biggest-upset", "🎰", "Biggest Upset", "Winner with the lowest pre-matchup Yahoo win probability.", upset.side.teamId, `${(upset.side.winProbability ?? 0).toFixed(0)}% win prob → W`, upset.matchup.matchupId));
    }

    const choke = [...sides]
      .filter(({ side }) => side.projectedScore != null)
      .map((entry) => ({ ...entry, delta: entry.side.score - (entry.side.projectedScore ?? entry.side.score) }))
      .sort((a, b) => a.delta - b.delta)[0];
    if (choke && choke.delta < 0) {
      result.push(award(week, season, "biggest-choke", "😬", "Biggest Choke", "Largest negative difference between actual score and pre-matchup projected score.", choke.side.teamId, `${choke.delta.toFixed(1)} vs projection`, choke.matchup.matchupId));
    }

    const iceCold = [...winners].sort((a, b) => a.side.score - b.side.score)[0];
    if (iceCold) {
      result.push(award(week, season, "ice-cold", "🧊", "Ice Cold", "Lowest score among the week's winners.", iceCold.side.teamId, `${iceCold.side.score.toFixed(1)} pts, still won`, iceCold.matchup.matchupId));
    }

    const statement = [...winners]
      .map((entry) => ({ ...entry, margin: entry.side.score - entry.opponent.score }))
      .sort((a, b) => b.margin - a.margin)[0];
    if (statement && statement.margin > 0) {
      result.push(award(week, season, "statement-win", "👑", "Statement Win", "Largest margin of victory in the completed week.", statement.side.teamId, `won by ${statement.margin.toFixed(1)}`, statement.matchup.matchupId));
    }

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
    if (explosion && explosion.delta > 0) {
      result.push(award(week, season, "explosion", "💣", "Explosion", "Largest jump above the team's average score from prior completed weeks.", explosion.side.teamId, `+${explosion.delta.toFixed(1)} vs season avg`, explosion.matchup.matchupId));
    }

    const previousWeekScores = new Map<string, number>();
    for (const m of matchups.filter((m) => m.status === "final" && m.week === week - 1)) {
      previousWeekScores.set(m.home.teamId, m.home.score);
      previousWeekScores.set(m.away.teamId, m.away.score);
    }
    const changes = [...sides]
      .map((entry) => (previousWeekScores.has(entry.side.teamId)
        ? { ...entry, delta: entry.side.score - previousWeekScores.get(entry.side.teamId)! }
        : null))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const up = [...changes].sort((a, b) => b.delta - a.delta)[0];
    const down = [...changes].sort((a, b) => a.delta - b.delta)[0];
    if (up && up.delta > 0) {
      result.push(award(week, season, "trending-up", "📈", "Trending Up", "Biggest improvement over the team's immediately preceding completed-week score.", up.side.teamId, `+${up.delta.toFixed(1)} vs last week`, up.matchup.matchupId));
    }
    if (down && down.delta < 0) {
      result.push(award(week, season, "trending-down", "📉", "Trending Down", "Biggest decline versus the team's immediately preceding completed-week score.", down.side.teamId, `${down.delta.toFixed(1)} vs last week`, down.matchup.matchupId));
    }

    const donkey = findDonkey(matchups, week, season);
    if (donkey) result.push(donkey);
  }

  return result;
}

export function attachRosters(matchups: Matchup[], rosterByWeekAndTeam: Map<string, PlayerScore[]>): Matchup[] {
  return matchups.map((m) => {
    const homePlayers = rosterByWeekAndTeam.get(`${m.week}|${m.home.teamId}`) || m.home.players;
    const awayPlayers = rosterByWeekAndTeam.get(`${m.week}|${m.away.teamId}`) || m.away.players;
    return {
      ...m,
      home: { ...m.home, players: homePlayers },
      away: { ...m.away, players: awayPlayers },
    };
  });
}

export function buildLeagueBundle(raw: RawData) {
  const metadata = raw.metadata;
  const season = num(first(metadata, "season"), Number(process.env.YAHOO_SEASON || new Date().getFullYear()));
  const currentWeek = num(first(metadata, "current_week"), 1);
  const teams = parseTeams(raw.teams);

  const matchupsByWeek = Object.entries(raw.scoreboards).flatMap(([week, body]) =>
    parseMatchups(body, season, Number(week)).map((m) => ({ ...m, week: m.week || Number(week) })),
  );
  const deduped = [...new Map(matchupsByWeek.map((m) => [`${m.week}-${[m.home.teamId, m.away.teamId].sort().join("-")}`, m])).values()];

  const rosterByWeekAndTeam = new Map<string, PlayerScore[]>();
  for (const [key, body] of Object.entries(raw.rosters)) {
    const [week, teamKey] = key.split("|");
    if (teamKey === "all") {
      for (const team of recordsWithKey(body, "team_key")) {
        const teamId = normalizeTeamId(team.team_key, team.team_id);
        if (week && teamId) rosterByWeekAndTeam.set(`${week}|${teamId}`, parsePlayerScores(team));
      }
      continue;
    }
    const teamId = normalizeTeamId(teamKey);
    if (week && teamId) rosterByWeekAndTeam.set(`${week}|${teamId}`, parsePlayerScores(body));
  }

  const history = attachRosters(deduped, rosterByWeekAndTeam);
  const parsedStandings = parseStandings(raw.standings);
  const standings = deriveStandings(teams, parsedStandings, history);
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
  const currentRosters: Record<string, PlayerScore[]> = {};
  for (const [key, players] of rosterByWeekAndTeam) {
    const [week, teamId] = key.split("|");
    if (Number(week) === currentWeek) currentRosters[teamId] = players;
  }
  if (Object.keys(currentRosters).length === 0) {
    for (const m of currentMatchups) {
      currentRosters[m.home.teamId] = m.home.players;
      currentRosters[m.away.teamId] = m.away.players;
    }
  }

  return { league, teams, standings, history, currentMatchups, superlatives, superlativeHistory, transactions, currentRosters };
}
