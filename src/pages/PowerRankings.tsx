import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { Matchup, TeamStanding } from "@/types/league";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

function sortForPowerRankings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    const ag = a.wins + a.losses + a.ties;
    const bg = b.wins + b.losses + b.ties;
    return (
      (bg ? b.pointsFor / bg : 0) - (ag ? a.pointsFor / ag : 0) ||
      b.winPct - a.winPct ||
      a.teamId.localeCompare(b.teamId)
    );
  });
}

function standingsThroughWeek(
  teams: LeagueBundle["teams"],
  matchups: Matchup[],
  week: number,
): TeamStanding[] {
  const stats = new Map<
    string,
    { wins: number; losses: number; ties: number; pointsFor: number }
  >();

  for (const team of teams) {
    stats.set(team.teamId, { wins: 0, losses: 0, ties: 0, pointsFor: 0 });
  }

  for (const matchup of matchups) {
    if (matchup.status !== "final" || matchup.week > week) continue;
    const home = stats.get(matchup.home.teamId);
    const away = stats.get(matchup.away.teamId);
    if (!home || !away) continue;

    home.pointsFor += matchup.home.score;
    away.pointsFor += matchup.away.score;

    if (matchup.home.score > matchup.away.score) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.away.score > matchup.home.score) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  return teams.map((team) => {
    const value = stats.get(team.teamId)!;
    const games = value.wins + value.losses + value.ties;
    return {
      teamId: team.teamId,
      rank: 0,
      wins: value.wins,
      losses: value.losses,
      ties: value.ties,
      pointsFor: value.pointsFor,
      pointsAgainst: 0,
      winPct: games ? (value.wins + value.ties * 0.5) / games : 0,
      streak: { type: "L" as const, count: 0 },
      playoffStatus: "unknown" as const,
      divisionId: team.divisionId ?? null,
    };
  });
}

export function PowerRankings() {
  const { league, teams, standings, matchups } =
    useOutletContext<LeagueBundle>();
  const hasResults = matchups.some((m) => m.status === "final");
  const rows = sortForPowerRankings(standings);

  const completedWeeks = [...league.completedWeeks].sort((a, b) => a - b);
  const latestCompletedWeek = completedWeeks.at(-1) ?? 0;
  const previousCompletedWeek =
    completedWeeks.filter((week) => week < latestCompletedWeek).at(-1) ?? 0;
  const previousRanks = new Map<string, number>();

  if (previousCompletedWeek > 0) {
    sortForPowerRankings(
      standingsThroughWeek(teams, matchups, previousCompletedWeek),
    ).forEach((row, index) => {
      previousRanks.set(row.teamId, index + 1);
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
          Sorted by points per completed game, with win percentage as the tiebreaker. This is a descriptive ranking, not a Yahoo projection.
        </p>
      </div>

      {!hasResults ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-8 text-center text-sm text-muted">
          Rankings appear after completed matchups are available.
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
          {rows.map((row, index) => {
            const team = teamById(teams, row.teamId);
            const currentRank = index + 1;
            const previousRank = previousRanks.get(row.teamId);
            const movement =
              previousRank == null ? null : previousRank - currentRank;

            return (
              <div
                key={row.teamId}
                className="flex items-center gap-4 px-5 py-4"
              >
                <span className="score-num w-8 text-xl text-faint">
                  #{currentRank}
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
                    {(
                      (row.wins + row.losses + row.ties
                        ? row.pointsFor /
                          (row.wins + row.losses + row.ties)
                        : 0)
                    ).toFixed(1)}{" "}
                    pts/game
                  </p>
                </div>
                <span className="score-num text-lg text-gold">
                  {row.pointsFor.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
