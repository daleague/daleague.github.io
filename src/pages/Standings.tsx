import { Link, useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { PlayoffStatus, TeamStanding } from "@/types/league";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

const STATUS_STYLES: Record<PlayoffStatus, { label: string; className: string }> = {
  clinched: { label: "CLINCHED", className: "bg-win/15 text-win" },
  in: { label: "IN", className: "bg-win/15 text-win" },
  bubble: { label: "BUBBLE", className: "bg-gold/15 text-gold" },
  out: { label: "OUT", className: "bg-card-raised text-muted" },
  eliminated: { label: "ELIMINATED", className: "bg-live/15 text-live" },
  unknown: { label: "—", className: "bg-card-raised text-faint" },
};

function streakLabel(streak: TeamStanding["streak"]): string {
  return `${streak.type}${streak.count}`;
}

export function Standings() {
  const { league, teams, standings } = useOutletContext<LeagueBundle>();
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Standings</h1>
        <p className="mt-1 text-sm text-muted">Through the end of Week {Math.max(...league.completedWeeks, 0)}.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-card shadow-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left font-display text-xs tracking-wider text-faint">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold text-right">Record</th>
              <th className="px-4 py-3 font-semibold text-right">PF</th>
              <th className="px-4 py-3 font-semibold text-right">PA</th>
              <th className="px-4 py-3 font-semibold text-right">Streak</th>
              <th className="px-4 py-3 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const team = teamById(teams, s.teamId);
              const status = STATUS_STYLES[s.playoffStatus];
              return (
                <tr key={s.teamId} className="border-b border-hairline/60 last:border-0 hover:bg-card-raised">
                  <td className="px-4 py-3 font-mono text-muted">{s.rank}</td>
                  <td className="px-4 py-3">
                    <Link to={`/team/${s.teamId}`} className="flex items-center gap-3">
                      <TeamBadge team={team} size="sm" />
                      <span className="font-display text-sm text-ink">{team?.name ?? "Unknown"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {s.wins}-{s.losses}
                    {s.ties > 0 ? `-${s.ties}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{s.pointsFor.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{s.pointsAgainst.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{streakLabel(s.streak)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded-full px-2.5 py-1 font-display text-[11px] font-semibold tracking-wide ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
