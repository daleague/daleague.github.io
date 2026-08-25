import { Link, useOutletContext, useParams } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { PlayerScore } from "@/types/league";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

function bySlotOrder(a: PlayerScore, b: PlayerScore): number {
  const order = ["QB", "RB", "WR", "TE", "FLEX", "W/R/T", "DEF", "K", "BN", "IR"];
  const ai = order.indexOf(a.slot);
  const bi = order.indexOf(b.slot);
  return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
}

export function MatchupDetail() {
  const { teams, matchups } = useOutletContext<LeagueBundle>();
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
  const margin = Math.abs(matchup.home.score - matchup.away.score);
  const homeStarters = [...matchup.home.players].filter((p) => p.isStarter).sort(bySlotOrder);
  const awayStarters = [...matchup.away.players].filter((p) => p.isStarter).sort(bySlotOrder);

  const homeTop = [...matchup.home.players].sort((a, b) => b.points - a.points)[0];
  const awayTop = [...matchup.away.players].sort((a, b) => b.points - a.points)[0];
  const topOverall = homeTop && awayTop ? (homeTop.points >= awayTop.points ? homeTop : awayTop) : homeTop ?? awayTop;

  return (
    <div className="space-y-8">
      <Link to="/" className="font-display text-xs tracking-wide text-muted hover:text-ink">
        ← Back to Week {matchup.week}
      </Link>

      <div className="rounded-2xl border border-hairline bg-card p-6 shadow-card sm:p-8">
        <p className="text-center font-display text-xs font-semibold tracking-[0.25em] text-faint">
          WEEK {matchup.week} {matchup.status === "final" ? "· FINAL" : matchup.status === "live" ? "· LIVE" : ""}
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 sm:gap-12">
          <TeamHeader team={away} score={matchup.away.score} isWinner={matchup.winnerTeamId === away?.teamId} />
          <span className="font-display text-sm text-faint">VS</span>
          <TeamHeader team={home} score={matchup.home.score} isWinner={matchup.winnerTeamId === home?.teamId} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <RosterTable label={away?.name ?? "Away"} players={awayStarters} />
        <RosterTable label={home?.name ?? "Home"} players={homeStarters} />
      </div>
    </div>
  );
}

function TeamHeader({ team, score, isWinner }: { team: ReturnType<typeof teamById>; score: number; isWinner: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamBadge team={team} size="lg" />
      <p className={`font-display text-sm ${isWinner ? "text-ink" : "text-muted"}`}>{team?.name ?? "TBD"}</p>
      <p className={`score-num text-5xl sm:text-6xl ${isWinner ? "text-gold" : "text-ink/80"}`}>{score.toFixed(1)}</p>
    </div>
  );
}

function RosterTable({ label, players }: { label: string; players: PlayerScore[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
      <div className="border-b border-hairline px-4 py-3 font-display text-sm text-ink">{label}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left font-display text-[11px] tracking-wider text-faint">
            <th className="px-4 py-2 font-semibold">Slot</th>
            <th className="px-4 py-2 font-semibold">Player</th>
            <th className="px-4 py-2 text-right font-semibold">Proj</th>
            <th className="px-4 py-2 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId} className="border-b border-hairline/60 last:border-0">
              <td className="px-4 py-2 font-mono text-xs text-faint">{p.slot}</td>
              <td className="px-4 py-2 text-ink">{p.name}</td>
              <td className="px-4 py-2 text-right font-mono text-faint">
                {p.projectedPoints !== undefined ? p.projectedPoints.toFixed(1) : "—"}
              </td>
              <td className="px-4 py-2 text-right font-mono text-ink">{p.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
