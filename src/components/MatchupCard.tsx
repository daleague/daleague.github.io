import { Link } from "react-router-dom";
import type { Matchup, Team } from "@/types/league";
import { TeamBadge } from "./TeamBadge";

interface MatchupCardProps {
  matchup: Matchup;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
}

function StatusPill({ status }: { status: Matchup["status"] }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 font-display text-[11px] font-semibold tracking-wider text-live">
        <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-dot" />
        LIVE
      </span>
    );
  }
  if (status === "final") {
    return (
      <span className="rounded-full bg-card-raised px-2.5 py-1 font-display text-[11px] font-semibold tracking-wider text-muted">
        FINAL
      </span>
    );
  }
  return (
    <span className="rounded-full bg-card-raised px-2.5 py-1 font-display text-[11px] font-semibold tracking-wider text-faint">
      UPCOMING
    </span>
  );
}

function TeamRow({
  team,
  score,
  projectedScore,
  winProbability,
  isWinner,
  status,
}: {
  team: Team | undefined;
  score: number;
  projectedScore?: number;
  winProbability?: number;
  isWinner: boolean;
  status: Matchup["status"];
}) {
  const faded = status === "final" && !isWinner;
  return (
    <div className={`flex items-center justify-between gap-3 ${faded ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 items-center gap-3">
        <TeamBadge team={team} size="md" />
        <div className="min-w-0">
          <p className={`truncate font-display text-sm ${isWinner ? "text-ink" : "text-muted"}`}>
            {team?.name ?? "TBD"}
          </p>
          {status !== "final" && (
            <p className="text-xs text-faint">
              {projectedScore !== undefined && <>proj {projectedScore.toFixed(1)}</>}
              {projectedScore !== undefined && winProbability !== undefined && " · "}
              {winProbability !== undefined && <>{winProbability}% win prob</>}
            </p>
          )}
        </div>
      </div>
      <span className={`score-num text-4xl ${isWinner ? "text-gold" : "text-ink/80"}`}>{score.toFixed(1)}</span>
    </div>
  );
}

export function MatchupCard({ matchup, homeTeam, awayTeam }: MatchupCardProps) {
  const { away, home, status, winnerTeamId } = matchup;
  const margin = Math.abs(home.score - away.score);
  const winnerTeam = winnerTeamId === home.teamId ? homeTeam : awayTeam;

  return (
    <Link
      to={`/matchup/${matchup.matchupId}`}
      className="group block rounded-2xl border border-hairline bg-card p-5 shadow-card transition hover:border-gold/40 hover:bg-card-raised"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-xs font-semibold tracking-[0.2em] text-faint">WEEK {matchup.week}</span>
        <StatusPill status={status} />
      </div>

      <div className="space-y-4">
        <TeamRow
          team={awayTeam}
          score={away.score}
          projectedScore={away.projectedScore}
          winProbability={away.winProbability}
          isWinner={winnerTeamId === away.teamId}
          status={status}
        />
        <div className="flex items-center gap-3 font-display text-[11px] tracking-widest text-faint">
          <span className="h-px flex-1 bg-hairline" />
          VS
          <span className="h-px flex-1 bg-hairline" />
        </div>
        <TeamRow
          team={homeTeam}
          score={home.score}
          projectedScore={home.projectedScore}
          winProbability={home.winProbability}
          isWinner={winnerTeamId === home.teamId}
          status={status}
        />
      </div>

      {status === "final" && winnerTeamId && (
        <p className="mt-4 border-t border-hairline pt-3 text-center font-display text-xs tracking-wider text-win">
          {winnerTeam?.name} won by {margin.toFixed(1)}
        </p>
      )}
    </Link>
  );
}
