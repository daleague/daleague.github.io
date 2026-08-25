/**
 * Canonical domain types for The League.
 *
 * IMPORTANT: teams are identified everywhere by `teamId`, which is the
 * stable Yahoo team ID (as a string). Names and icons can change season to
 * season or even mid-season — never key anything off `name`.
 */

export type TeamId = string;

export type PlayoffStatus = "clinched" | "in" | "bubble" | "out" | "eliminated" | "unknown";

export interface League {
  leagueId: string;
  gameId: string;
  season: number;
  name: string;
  numTeams: number;
  currentWeek: number;
  /** Weeks 1..N that have official, final results and are safe to treat as immutable. */
  completedWeeks: number[];
  timezone: string;
  /** True only for locally-generated sample data. Never true for real Yahoo data. */
  isMockData: boolean;
  lastUpdatedAt: string; // ISO timestamp
}

export interface Team {
  teamId: TeamId;
  name: string;
  iconUrl: string | null;
  managerName?: string;
  divisionId?: string | null;
  divisionName?: string | null;
}

export interface StreakInfo {
  type: "W" | "L" | "T";
  count: number;
}

export interface TeamStanding {
  teamId: TeamId;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  winPct: number;
  streak: StreakInfo;
  playoffStatus: PlayoffStatus;
  divisionId?: string | null;
}

export type RosterSlot =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "FLEX"
  | "W/R/T"
  | "DEF"
  | "K"
  | "BN"
  | "IR"
  | string;

export interface PlayerScore {
  playerId: string;
  name: string;
  slot: RosterSlot;
  nflTeam?: string;
  opponent?: string;
  points: number;
  projectedPoints?: number;
  isStarter: boolean;
  gameStatus?: "not_started" | "in_progress" | "final" | "bye";
}

export interface MatchupSide {
  teamId: TeamId;
  score: number;
  projectedScore?: number;
  winProbability?: number; // 0-100
  players: PlayerScore[];
}

export type MatchupStatus = "upcoming" | "live" | "final";

export interface Matchup {
  matchupId: string;
  season: number;
  week: number;
  status: MatchupStatus;
  home: MatchupSide;
  away: MatchupSide;
  winnerTeamId: TeamId | null;
  isPlayoffs?: boolean;
  playoffRound?: string | null;
}

export interface Superlative {
  id: string;
  emoji: string;
  title: string;
  description: string;
  teamId: TeamId;
  value: string;
  week: number;
  season: number;
  matchupId?: string;
}

export interface PowerRankingEntry {
  teamId: TeamId;
  rank: number;
  previousRank: number | null;
  rating: number; // 0-100 composite
  movement: number; // rank - previousRank, positive = moved up
}

export interface LuckEntry {
  teamId: TeamId;
  actualWins: number;
  actualLosses: number;
  expectedWins: number;
  expectedLosses: number;
  luckDifferential: number; // actualWins - expectedWins
}

export interface RecordEntry {
  id: string;
  title: string;
  teamId: TeamId;
  value: string;
  season: number;
  week?: number;
  matchupId?: string;
}
