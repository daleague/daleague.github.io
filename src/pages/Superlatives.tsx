import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { SuperlativeCard } from "@/components/SuperlativeCard";

export function Superlatives() {
  const { league, teams, superlativeHistory } = useOutletContext<LeagueBundle>();

  const byWeek = new Map<number, typeof superlativeHistory>();
  for (const superlative of superlativeHistory) {
    const existing = byWeek.get(superlative.week) ?? [];
    existing.push(superlative);
    byWeek.set(superlative.week, existing);
  }

  const weeks = [...byWeek.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Superlatives</h1>
        <p className="mt-1 text-sm text-muted">
          Weekly awards from completed matchups. Hover an award title to see exactly how it is defined.
        </p>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
          <p className="font-display text-sm font-semibold text-ink">No weekly awards yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Awards will appear here once completed weekly snapshots are available.
          </p>
        </div>
      ) : (
        weeks.map((week) => (
          <section key={week}>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-sm font-semibold tracking-[0.25em] text-faint">WEEK {week}</h2>
              <span className="font-mono text-xs text-faint">{byWeek.get(week)!.length} awards</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byWeek.get(week)!.map((superlative) => (
                <SuperlativeCard
                  key={superlative.id}
                  superlative={superlative}
                  team={teamById(teams, superlative.teamId)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
