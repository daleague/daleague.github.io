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
  completedWeeks: number[];
  timezone: string;
  isMockData: boolean;
  lastUpdatedAt: string;
}

export interface ManagerProfile {
  managerId: string;
  managerName: string;
  level: string | null;
  rating: number | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number | null;
  trophiesWon: number;
  firstPlaceTrophies: number;
  bestSeasonFinish: string | null;
  playingSince: number | null;
  teamsManaged: number;
  profileUrl?: string | null;
}

export interface Team {
  teamId: TeamId;
  name: string;
  iconUrl: string | null;
  managerName?: string;
  managerId?: string | null;
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

export type RosterSlot = "QB" | "RB" | "WR" | "TE" | "FLEX" | "W/R/T" | "DEF" | "K" | "BN" | "IR" | string;

export interface PlayerScore {
  playerId: string;
  name: string;
  slot: RosterSlot;
  actualPosition?: "QB" | "RB" | "WR" | "TE" | string;
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
  winProbability?: number;
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
  rating: number;
  movement: number;
}

export interface LuckEntry {
  teamId: TeamId;
  actualWins: number;
  actualLosses: number;
  expectedWins: number;
  expectedLosses: number;
  luckDifferential: number;
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
