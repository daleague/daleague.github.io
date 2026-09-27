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
    const teamId = str(team.team_key || team.team_id);
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
    const teamId = str(team.team_key || team.team_id);
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
