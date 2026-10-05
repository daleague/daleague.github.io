import { Link, useOutletContext, useParams } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { IS_MANAGER_PROFILE_ENABLED } from "@/data/dataSource";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";
import { ManagerComparison } from "@/components/ManagerProfile";
import { RosterTable, bySlotOrder } from "@/components/RosterTable";
import { LastUpdated } from "@/components/LastUpdated";

export function MatchupDetail() {
  const { league, teams, matchups, managerProfiles } = useOutletContext<LeagueBundle>();
  const { matchupId } = useParams<{ matchupId: string }>();
  const matchup = matchups.find((m) => m.matchupId === matchupId);

  if (!matchup) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
        <p className="font-display text-sm font-semibold text-ink">Matchup not found</p>
        <p className="mt-2 text-sm text-muted">
          It may belong to a week that hasn't been snapshotted yet.{" "}
          <Link to="/" className="text-gold underline underline-offset-2">
            Back to this week
          </Link>
        </p>
      </div>
    );
  }

  const home = teamById(teams, matchup.home.teamId);
  const away = teamById(teams, matchup.away.teamId);
  const homeManager = home?.managerId ? managerProfiles.find((manager) => manager.managerId === home.managerId) : undefined;
  const awayManager = away?.managerId ? managerProfiles.find((manager) => manager.managerId === away.managerId) : undefined;
  const margin = Math.abs(matchup.home.score - matchup.away.score);
  const homeStarters = [...matchup.home.players].filter((p) => p.isStarter).sort(bySlotOrder);
  const awayStarters = [...matchup.away.players].filter((p) => p.isStarter).sort(bySlotOrder);
  const homeBench = [...matchup.home.players].filter((p) => !p.isStarter).sort(bySlotOrder);
  const awayBench = [...matchup.away.players].filter((p) => !p.isStarter).sort(bySlotOrder);
  const homeShown = homeStarters.length ? homeStarters : [...matchup.home.players].sort(bySlotOrder);
  const awayShown = awayStarters.length ? awayStarters : [...matchup.away.players].sort(bySlotOrder);

  const homeTop = [...matchup.home.players].filter((p) => p.points > 0).sort((a, b) => b.points - a.points)[0];
  const awayTop = [...matchup.away.players].filter((p) => p.points > 0).sort((a, b) => b.points - a.points)[0];
  const topOverall = homeTop && awayTop ? (homeTop.points >= awayTop.points ? homeTop : awayTop) : homeTop ?? awayTop;

  return (
    <div className="space-y-8">
      <Link to={`/week/${matchup.week}`} className="font-display text-xs tracking-wide text-muted hover:text-ink">
        ← Back to Week {matchup.week}
      </Link>

      <LastUpdated league={league} className="-mt-5" />

      <div className="rounded-2xl border border-hairline bg-card p-6 shadow-card sm:p-8">
        <p className="text-center font-display text-xs font-semibold tracking-[0.25em] text-faint">
          WEEK {matchup.week} {matchup.status === "final" ? "· FINAL" : matchup.status === "live" ? "· LIVE" : ""}
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 sm:gap-12">
          <TeamHeader team={away} score={matchup.away.score} isWinner={matchup.winnerTeamId === away?.teamId} winProbability={matchup.away.winProbability} />
          <span className="font-display text-sm text-faint">VS</span>
          <TeamHeader team={home} score={matchup.home.score} isWinner={matchup.winnerTeamId === home?.teamId} winProbability={matchup.home.winProbability} />
        </div>
        {matchup.status === "final" && (
          <p className="mt-6 text-center font-display text-sm tracking-wide text-win">
            {(matchup.winnerTeamId === home?.teamId ? home : away)?.name} won by {margin.toFixed(1)}
          </p>
        )}
        {topOverall && (
          <p className="mt-2 text-center text-xs text-faint">
            Top performer: {topOverall.name} ({topOverall.points.toFixed(1)} pts)
          </p>
        )}
      </div>

      {IS_MANAGER_PROFILE_ENABLED && (homeManager || awayManager) && (
        <ManagerComparison left={awayManager} right={homeManager} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RosterTable label={`${away?.name ?? "Away"} — Starters`} players={awayShown} />
        <RosterTable label={`${home?.name ?? "Home"} — Starters`} players={homeShown} />
        <RosterTable label={`${away?.name ?? "Away"} — Bench`} players={awayStarters.length ? awayBench : []} />
        <RosterTable label={`${home?.name ?? "Home"} — Bench`} players={homeStarters.length ? homeBench : []} />
      </div>
    </div>
  );
}

function TeamHeader({ team, score, isWinner, winProbability }: { team: ReturnType<typeof teamById>; score: number; isWinner: boolean; winProbability?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamBadge team={team} size="lg" />
      <p className={`font-display text-sm ${isWinner ? "text-ink" : "text-muted"}`}>{team?.name ?? "TBD"}</p>
      <p className={`score-num text-5xl sm:text-6xl ${isWinner ? "text-gold" : "text-ink/80"}`}>{score.toFixed(1)}</p>
      {winProbability !== undefined && <p className="text-xs text-faint">{winProbability}% win prob</p>}
    </div>
  );
}
