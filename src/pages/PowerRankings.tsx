import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { Matchup, Team } from "@/types/league";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

export interface PowerRankingComponents {
  wp: number;
  pfz: number;
  mov: number;
  stk: number;
  awp: number;
}

export interface CalculatedPowerRanking {
  teamId: string;
  rank: number;
  rating: number;
  components: PowerRankingComponents;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsPerGame: number;
  averageMargin: number;
  streak: { type: "W" | "L" | "T"; count: number };
  allPlayPct: number;
}

interface TeamStats {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  results: Array<"W" | "L" | "T">;
}

function clampStreak(count: number): number {
  return Math.max(-5, Math.min(5, count));
}

function minMax(value: number, min: number, max: number): number {
  return max === min ? 0.5 : (value - min) / (max - min);
}

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function completedMatchupsThroughWeek(
  matchups: Matchup[],
  throughWeek: number,
): Matchup[] {
  return matchups
    .filter((matchup) => matchup.status === "final" && matchup.week <= throughWeek)
    .sort(
      (a, b) =>
        a.week - b.week || a.matchupId.localeCompare(b.matchupId),
    );
}

function teamStatsThroughWeek(
  teams: Team[],
  matchups: Matchup[],
  throughWeek: number,
): Map<string, TeamStats> {
  const stats = new Map<string, TeamStats>();

  for (const team of teams) {
    stats.set(team.teamId, {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      results: [],
    });
  }

  for (const matchup of completedMatchupsThroughWeek(matchups, throughWeek)) {
    const home = stats.get(matchup.home.teamId);
    const away = stats.get(matchup.away.teamId);
    if (!home || !away) continue;

    home.pointsFor += matchup.home.score;
    home.pointsAgainst += matchup.away.score;
    away.pointsFor += matchup.away.score;
    away.pointsAgainst += matchup.home.score;

    if (matchup.home.score > matchup.away.score) {
      home.wins += 1;
      away.losses += 1;
      home.results.push("W");
      away.results.push("L");
    } else if (matchup.away.score > matchup.home.score) {
      away.wins += 1;
      home.losses += 1;
      away.results.push("W");
      home.results.push("L");
    } else {
      home.ties += 1;
      away.ties += 1;
      home.results.push("T");
      away.results.push("T");
    }
  }

  return stats;
}

function currentStreak(
  results: Array<"W" | "L" | "T">,
): { type: "W" | "L" | "T"; count: number } {
  const last = results.at(-1);
  if (!last || last === "T") return { type: "T", count: 0 };

  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) {
    count += 1;
  }
  return { type: last, count };
}

function allPlayPercentThroughWeek(
  teams: Team[],
  matchups: Matchup[],
  throughWeek: number,
): Map<string, number> {
  const weeklyScores = new Map<number, Map<string, number>>();

  for (const matchup of completedMatchupsThroughWeek(matchups, throughWeek)) {
    const scores = weeklyScores.get(matchup.week) ?? new Map<string, number>();
    scores.set(matchup.home.teamId, matchup.home.score);
    scores.set(matchup.away.teamId, matchup.away.score);
    weeklyScores.set(matchup.week, scores);
  }

  const allPlayWins = new Map<string, number>();
  const allPlayGames = new Map<string, number>();
  for (const team of teams) {
    allPlayWins.set(team.teamId, 0);
    allPlayGames.set(team.teamId, 0);
  }

  for (const scores of weeklyScores.values()) {
    for (const [teamId, score] of scores) {
      for (const [opponentId, opponentScore] of scores) {
        if (teamId === opponentId) continue;
        allPlayGames.set(
          teamId,
          (allPlayGames.get(teamId) ?? 0) + 1,
        );
        if (score > opponentScore) {
          allPlayWins.set(teamId, (allPlayWins.get(teamId) ?? 0) + 1);
        } else if (score === opponentScore) {
          allPlayWins.set(teamId, (allPlayWins.get(teamId) ?? 0) + 0.5);
        }
      }
    }
  }

  return new Map(
    teams.map((team) => {
      const games = allPlayGames.get(team.teamId) ?? 0;
      return [
        team.teamId,
        games > 0 ? (allPlayWins.get(team.teamId) ?? 0) / games : 0.5,
      ];
    }),
  );
}

export function calculatePowerRankings(
  teams: Team[],
  matchups: Matchup[],
  throughWeek: number,
): CalculatedPowerRanking[] {
  const stats = teamStatsThroughWeek(teams, matchups, throughWeek);
  const completed = completedMatchupsThroughWeek(matchups, throughWeek);

  if (completed.length === 0) return [];

  const ppgByTeam = new Map<string, number>();
  const marginByTeam = new Map<string, number>();

  for (const team of teams) {
    const stat = stats.get(team.teamId);
    const games = stat
      ? stat.wins + stat.losses + stat.ties
      : 0;
    ppgByTeam.set(
      team.teamId,
      games > 0 ? (stat?.pointsFor ?? 0) / games : 0,
    );
    marginByTeam.set(
      team.teamId,
      games > 0
        ? ((stat?.pointsFor ?? 0) - (stat?.pointsAgainst ?? 0)) / games
        : 0,
    );
  }

  const ppgValues = [...ppgByTeam.values()];
  const ppgAverage =
    ppgValues.reduce((sum, points) => sum + points, 0) / ppgValues.length;
  const ppgStdDev = populationStdDev(ppgValues);
  const pfzRaw = new Map<string, number>();

  for (const team of teams) {
    pfzRaw.set(
      team.teamId,
      ppgStdDev === 0
        ? 0
        : ((ppgByTeam.get(team.teamId) ?? 0) - ppgAverage) / ppgStdDev,
    );
  }

  const pfzValues = [...pfzRaw.values()];
  const pfzMin = Math.min(...pfzValues);
  const pfzMax = Math.max(...pfzValues);

  const marginValues = [...marginByTeam.values()];
  const marginMin = Math.min(...marginValues);
  const marginMax = Math.max(...marginValues);

  const allPlayPct = allPlayPercentThroughWeek(teams, matchups, throughWeek);

  const rows = teams.map((team) => {
    const stat = stats.get(team.teamId)!;
    const games = stat.wins + stat.losses + stat.ties;
    const streak = currentStreak(stat.results);
    const wp = games > 0 ? (stat.wins + stat.ties * 0.5) / games : 0;
    const pfz = minMax(pfzRaw.get(team.teamId) ?? 0, pfzMin, pfzMax);
    const mov = minMax(marginByTeam.get(team.teamId) ?? 0, marginMin, marginMax);
    const stk = 0.5 + clampStreak(streak.count) / 10;
    const awp = allPlayPct.get(team.teamId) ?? 0.5;
    const rating =
      wp * 35 +
      pfz * 30 +
      mov * 15 +
      stk * 10 +
      awp * 10;

    return {
      teamId: team.teamId,
      rank: 0,
      rating,
      components: { wp, pfz, mov, stk, awp },
      wins: stat.wins,
      losses: stat.losses,
      ties: stat.ties,
      pointsFor: stat.pointsFor,
      pointsPerGame: games > 0 ? stat.pointsFor / games : 0,
      averageMargin:
        games > 0
          ? (stat.pointsFor - stat.pointsAgainst) / games
          : 0,
      streak,
      allPlayPct: awp,
    };
  });

  rows.sort(
    (a, b) =>
      b.rating - a.rating ||
      b.pointsPerGame - a.pointsPerGame ||
      b.wins - a.wins ||
      a.teamId.localeCompare(b.teamId),
  );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

export function PowerRankings() {
  const { league, teams, matchups } =
    useOutletContext<LeagueBundle>();
  const completedWeeks = [...league.completedWeeks].sort((a, b) => a - b);
  const latestCompletedWeek = completedWeeks.at(-1) ?? 0;
  const rows =
    latestCompletedWeek > 0
      ? calculatePowerRankings(teams, matchups, latestCompletedWeek)
      : [];

  const previousCompletedWeek =
    completedWeeks.filter((week) => week < latestCompletedWeek).at(-1) ?? 0;
  const previousRanks = new Map<string, number>();

  if (previousCompletedWeek > 0) {
    calculatePowerRankings(
      teams,
      matchups,
      previousCompletedWeek,
    ).forEach((row) => {
      previousRanks.set(row.teamId, row.rank);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">
          {league.season} SEASON
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
          Power Rankings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fantasy Power Score: 35% winning percentage + 30% scoring strength +
          15% margin of victory + 10% current streak + 10% all-play percentage.
          Rankings use completed weeks only.
        </p>
        <div className="mt-3 rounded-xl border border-hairline bg-card/50 px-4 py-3 text-xs text-faint">
          PFZ is points-per-game converted to a league-wide z-score and then
          min-max normalized. MOV is average signed margin, also min-max
          normalized. STK runs from 0.0 (5+ game losing streak) to 1.0 (5+
          game winning streak). AWP asks how often each team would have
          beaten every other team in every completed week.
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-8 text-center text-sm text-muted">
          Rankings appear after completed matchups are available.
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
          {rows.map((row) => {
            const team = teamById(teams, row.teamId);
            const previousRank = previousRanks.get(row.teamId);
            const movement =
              previousRank == null ? null : previousRank - row.rank;
            const streakLabel =
              row.streak.count === 0
                ? "—"
                : `${row.streak.type}${row.streak.count}`;

            return (
              <div
                key={row.teamId}
                className="flex items-center gap-4 px-5 py-4"
              >
                <span className="score-num w-8 text-xl text-faint">
                  #{row.rank}
                </span>
                <span
                  className="flex w-10 shrink-0 items-center justify-center font-mono text-xs"
                  aria-label={
                    movement == null
                      ? "No previous ranking"
                      : movement > 0
                        ? `Up ${movement} spot${movement === 1 ? "" : "s"}`
                        : movement < 0
                          ? `Down ${Math.abs(movement)} spot${Math.abs(movement) === 1 ? "" : "s"}`
                          : "No movement"
                  }
                >
                  {movement == null || movement === 0 ? (
                    <span className="text-faint">—</span>
                  ) : movement > 0 ? (
                    <span className="text-win">↑{movement}</span>
                  ) : (
                    <span className="text-live">↓{Math.abs(movement)}</span>
                  )}
                </span>
                <TeamBadge team={team} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-ink">
                    {team?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-faint">
                    {row.wins}-{row.losses}
                    {row.ties ? `-${row.ties}` : ""} ·{" "}
                    {row.pointsPerGame.toFixed(1)} pts/game ·{" "}
                    {row.averageMargin >= 0 ? "+" : ""}
                    {row.averageMargin.toFixed(1)} MOV ·{" "}
                    {streakLabel}
                  </p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-faint">
                    WP ${(row.components.wp * 100).toFixed(0)} · PFZ{" "}
                    {(row.components.pfz * 100).toFixed(0)} · MOV{" "}
                    {(row.components.mov * 100).toFixed(0)} · STK{" "}
                    {(row.components.stk * 100).toFixed(0)} · AWP{" "}
                    {(row.components.awp * 100).toFixed(0)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="score-num text-lg text-gold">
                    {row.rating.toFixed(1)}
                  </span>
                  <p className="text-[10px] font-display tracking-wider text-faint">
                    FPS
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
