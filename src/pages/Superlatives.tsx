import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { SuperlativeCard } from "@/components/SuperlativeCard";

const SUPERLATIVE_ORDER = [
  "Team of the Week",
  "Dumpster Fire of the Week",
  "Pain of the Week",
  "Biggest Upset",
  "Biggest Choke",
  "Ice Cold",
  "Statement Win",
  "Brick Wall",
  "Explosion",
  "Trending Up",
  "Trending Down",
  "Donkey of the Week",
];

export function Superlatives() {
  const { league, teams, superlativeHistory } = useOutletContext<LeagueBundle>();

  const byTitle = new Map<string, typeof superlativeHistory>();
  for (const superlative of superlativeHistory) {
    const existing = byTitle.get(superlative.title) ?? [];
    existing.push(superlative);
    byTitle.set(superlative.title, existing);
  }

  const titles = [
    ...SUPERLATIVE_ORDER,
    ...[...byTitle.keys()].filter((title) => !SUPERLATIVE_ORDER.includes(title)),
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Superlatives</h1>
        <p className="mt-1 text-sm text-muted">
          Weekly awards, grouped by superlative. Each section shows every week that award was earned.
        </p>
      </div>

      {titles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
          <p className="font-display text-sm font-semibold text-ink">No weekly awards yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Awards will appear here once completed weekly snapshots are available.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {titles.map((title) => {
            const awards = [...(byTitle.get(title) ?? [])].sort((a, b) => b.week - a.week);

            return (
              <section key={title}>
                <div className="mb-3 flex items-end justify-between border-b border-hairline pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{awards[0]?.emoji ?? "🫏"}</span>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
                      <p className="mt-0.5 text-xs text-muted">
                        {awards[0]?.description ?? "No award has been recorded for this superlative yet."}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-faint">{awards.length} week{awards.length === 1 ? "" : "s"}</span>
                </div>

                {awards.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {awards.map((superlative) => (
                      <div key={superlative.id} className="relative">
                        <div className="absolute left-4 top-3 z-10 rounded-md bg-card-raised/90 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-faint">
                          WEEK {superlative.week}
                        </div>
                        <SuperlativeCard
                          superlative={superlative}
                          team={teamById(teams, superlative.teamId)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-hairline bg-card/40 p-6 text-sm text-muted">
                    No award recorded yet.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
