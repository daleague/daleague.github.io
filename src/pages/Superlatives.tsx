import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

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

const SUPERLATIVE_EMOJIS: Record<string, string> = {
  "Team of the Week": "🔥",
  "Dumpster Fire of the Week": "💩",
  "Pain of the Week": "🫠",
  "Biggest Upset": "🎰",
  "Biggest Choke": "😬",
  "Ice Cold": "🧊",
  "Statement Win": "👑",
  "Brick Wall": "🧱",
  "Explosion": "💣",
  "Trending Up": "📈",
  "Trending Down": "📉",
  "Donkey of the Week": "🫏",
};

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
          Weekly awards, grouped by superlative. Hover a section header to see how each award is defined.
        </p>
      </div>

      <div className="space-y-10">
        {titles.map((title) => {
          const awards = [...(byTitle.get(title) ?? [])].sort((a, b) => b.week - a.week);
          const description = awards[0]?.description ?? "No award has been recorded for this superlative yet.";
          const emoji = SUPERLATIVE_EMOJIS[title] ?? awards[0]?.emoji ?? "🏆";

          return (
            <section key={title}>
              <div className="group relative mb-3 flex items-end justify-between border-b border-hairline pb-3">
                <div className="relative flex items-center gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <h2
                      className="font-display text-lg font-semibold text-ink underline decoration-dotted decoration-faint/60 underline-offset-4"
                      title={description}
                    >
                      {title}
                    </h2>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-72 rounded-lg border border-hairline bg-card-raised p-3 text-xs leading-relaxed text-muted shadow-card group-hover:block"
                    >
                      {description}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-faint">{awards.length} week{awards.length === 1 ? "" : "s"}</span>
              </div>

              {awards.length > 0 ? (
                <div className="divide-y divide-hairline rounded-xl border border-hairline bg-card">
                  {awards.map((superlative) => (
                    <div key={superlative.id} className="flex items-center gap-4 px-4 py-3">
                      <span className="w-16 shrink-0 font-mono text-xs font-semibold tracking-wider text-faint">
                        WEEK {superlative.week}
                      </span>
                      <TeamBadge team={teamById(teams, superlative.teamId)} size="md" />
                      <span className="truncate text-sm text-ink">
                        {teamById(teams, superlative.teamId)?.name ?? "Unknown"}
                      </span>
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
    </div>
  );
}
