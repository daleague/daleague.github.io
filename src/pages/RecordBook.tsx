import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";
import type { Matchup } from "@/types/league";

interface RecordRow {
  label: string;
  value: string;
  teamId?: string;
  detail?: string;
}

function bestSingleWeek(matchups: Matchup[]): { teamId: string; score: number; week: number } | null {
  let best: { teamId: string; score: number; week: number } | null = null;
  for (const m of matchups.filter((x) => x.status === "final")) {
    for (const side of [m.home, m.away]) {
      if (!best || side.score > best.score) {
        best = { teamId: side.teamId, score: side.score, week: m.week };
      }
    }
  }
  return best;
}

function biggestBlowout(matchups: Matchup[]): { teamId: string; margin: number; week: number } | null {
  let best: { teamId: string; margin: number; week: number } | null = null;
  for (const m of matchups.filter((x) => x.status === "final" && x.winnerTeamId)) {
    const margin = Math.abs(m.home.score - m.away.score);
    if (!best || margin > best.margin) {
      best = { teamId: m.winnerTeamId!, margin, week: m.week };
    }
  }
  return best;
}

function lowestWinningScore(matchups: Matchup[]): { teamId: string; score: number; week: number } | null {
  let best: { teamId: string; score: number; week: number } | null = null;
  for (const m of matchups.filter((x) => x.status === "final" && x.winnerTeamId)) {
    const winner = m.home.teamId === m.winnerTeamId ? m.home : m.away;
    if (!best || winner.score < best.score) {
      best = { teamId: winner.teamId, score: winner.score, week: m.week };
    }
  }
  return best;
}

function highestLosingScore(matchups: Matchup[]): { teamId: string; score: number; week: number } | null {
  let best: { teamId: string; score: number; week: number } | null = null;
  for (const m of matchups.filter((x) => x.status === "final" && x.winnerTeamId)) {
    const loser = m.home.teamId === m.winnerTeamId ? m.away : m.home;
    if (!best || loser.score > best.score) {
      best = { teamId: loser.teamId, score: loser.score, week: m.week };
    }
  }
  return best;
}

export function RecordBook() {
  const { league, teams, matchups } = useOutletContext<LeagueBundle>();
  const finals = matchups.filter((m) => m.status === "final");

  if (finals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">League Record Book</h1>
        </div>
        <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-8 text-center">
          <p className="mx-auto max-w-md text-sm text-muted">
            Records unlock once completed weekly matchups with scores are available. Check back after the next data refresh.
          </p>
        </div>
      </div>
    );
  }

  const rows: RecordRow[] = [];
  const single = bestSingleWeek(finals);
  if (single) {
    rows.push({
      label: "Highest single-week score",
      value: single.score.toFixed(1),
      teamId: single.teamId,
      detail: `Week ${single.week}`,
    });
  }
  const blowout = biggestBlowout(finals);
  if (blowout) {
    rows.push({
      label: "Biggest blowout",
      value: `+${blowout.margin.toFixed(1)}`,
      teamId: blowout.teamId,
      detail: `Week ${blowout.week}`,
    });
  }
  const ice = lowestWinningScore(finals);
  if (ice) {
    rows.push({
      label: "Lowest winning score",
      value: ice.score.toFixed(1),
      teamId: ice.teamId,
      detail: `Week ${ice.week}`,
    });
  }
  const pain = highestLosingScore(finals);
  if (pain) {
    rows.push({
      label: "Highest losing score",
      value: pain.score.toFixed(1),
      teamId: pain.teamId,
      detail: `Week ${pain.week}`,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">League Record Book</h1>
        <p className="mt-1 text-sm text-muted">Season-to-date marks from completed matchups.</p>
      </div>

      <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-[10rem] flex-1">
              <p className="font-display text-sm font-semibold text-ink">{row.label}</p>
              {row.detail && <p className="text-xs text-faint">{row.detail}</p>}
            </div>
            {row.teamId && (
              <div className="flex items-center gap-2">
                <TeamBadge team={teamById(teams, row.teamId)} size="sm" />
                <span className="text-sm text-muted">{teamById(teams, row.teamId)?.name ?? "Unknown"}</span>
              </div>
            )}
            <span className="score-num text-2xl text-gold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
