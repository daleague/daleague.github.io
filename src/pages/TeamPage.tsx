import { Link, useOutletContext, useParams } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

export function TeamPage() {
  const { teams, standings, matchups } = useOutletContext<LeagueBundle>();
  const { teamId } = useParams<{ teamId: string }>();

  const team = teamId ? teamById(teams, teamId) : undefined;
  const standing = standings.find((s) => s.teamId === teamId);
  const thisWeekMatchup = matchups.find((m) => m.home.teamId === teamId || m.away.teamId === teamId);

  if (!team || !standing) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
        <p className="font-display text-sm font-semibold text-ink">Team not found</p>
        <Link to="/standings" className="mt-2 inline-block text-sm text-gold underline underline-offset-2">
          Back to standings
        </Link>
      </div>
    );
  }

  const avgScore = standing.wins + standing.losses + standing.ties > 0
    ? standing.pointsFor / (standing.wins + standing.losses + standing.ties)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <TeamBadge team={team} size="lg" />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{team.name}</h1>
          {team.managerName && <p className="text-sm text-muted">Managed by {team.managerName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Record" value={`${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`} />
        <Stat label="League Rank" value={`#${standing.rank}`} />
        <Stat label="Points For" value={standing.pointsFor.toFixed(1)} />
        <Stat label="Points Against" value={standing.pointsAgainst.toFixed(1)} />
        <Stat label="Avg / Week" value={avgScore.toFixed(1)} />
        <Stat label="Streak" value={`${standing.streak.type}${standing.streak.count}`} />
        <Stat label="Win %" value={`${(standing.winPct * 100).toFixed(0)}%`} />
        <Stat label="Playoff Status" value={standing.playoffStatus.toUpperCase()} />
      </div>

      {thisWeekMatchup && (
        <div>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-[0.25em] text-faint">THIS WEEK</h2>
          <Link
            to={`/matchup/${thisWeekMatchup.matchupId}`}
            className="block rounded-2xl border border-hairline bg-card p-4 text-sm text-muted transition hover:border-gold/40 hover:text-ink"
          >
            View the full box score for Week {thisWeekMatchup.week} →
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-6 text-center">
        <p className="text-sm text-muted">
          Season timeline, best/worst weeks, and streak history will appear here once weekly snapshots start
          accumulating.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <p className="font-display text-[11px] tracking-wide text-faint">{label}</p>
      <p className="score-num mt-1 text-2xl text-ink">{value}</p>
    </div>
  );
}
