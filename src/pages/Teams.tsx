import { Link, useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { TeamBadge } from "@/components/TeamBadge";

export function Teams() {
  const { teams, standings } = useOutletContext<LeagueBundle>();
  const sortedTeams = [...teams].sort((a, b) => {
    const aRank = standings.find((s) => s.teamId === a.teamId)?.rank ?? 999;
    const bRank = standings.find((s) => s.teamId === b.teamId)?.rank ?? 999;
    return aRank - bRank;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">LEAGUE DIRECTORY</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Teams</h1>
        <p className="mt-1 text-sm text-muted">Browse every team, manager, record, and season history.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedTeams.map((team) => {
          const standing = standings.find((s) => s.teamId === team.teamId);
          return (
            <Link
              key={team.teamId}
              to={`/team/${team.teamId}`}
              className="rounded-2xl border border-hairline bg-card p-5 transition hover:border-gold/40 hover:bg-card-raised"
            >
              <div className="flex items-center gap-3">
                <TeamBadge team={team} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold text-ink">{team.name}</p>
                  {team.managerName && <p className="truncate text-xs text-muted">{team.managerName}</p>}
                </div>
              </div>
              {standing && (
                <div className="mt-4 flex items-center justify-between border-t border-hairline/60 pt-3 text-xs">
                  <span className="text-faint">#{standing.rank}</span>
                  <span className="font-mono text-ink">
                    {standing.wins}-{standing.losses}{standing.ties ? `-${standing.ties}` : ""}
                  </span>
                  <span className="text-muted">{standing.pointsFor.toFixed(1)} PF</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
