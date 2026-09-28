import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { Superlative } from "@/types/league";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

const ORDER = [
  "Team of the Week",
  "Dumpster Fire of the Week",
  "Pain of the Week",
  "Biggest Upset",
  "Biggest Choke",
  "Ice Cold",
  "Statement Win",
  "Explosion",
  "Trending Up",
  "Trending Down",
  "Donkey of the Week",
];
const EMOJI: Record<string, string> = {
  "Team of the Week": "🔥",
  "Dumpster Fire of the Week": "💩",
  "Pain of the Week": "🫠",
  "Biggest Upset": "🎰",
  "Biggest Choke": "😬",
  "Ice Cold": "🧊",
  "Statement Win": "👑",
  Explosion: "💣",
  "Trending Up": "📈",
  "Trending Down": "📉",
  "Donkey of the Week": "🫏",
};
const WEEKLY_HISTORY_TITLES = new Set([
  "Explosion",
  "Trending Up",
  "Trending Down",
  "Donkey of the Week",
]);

export function Superlatives() {
  const { league, teams, superlatives, superlativeHistory, matchups } =
    useOutletContext<LeagueBundle>();
  const source = superlativeHistory.length ? superlativeHistory : superlatives;
  const byTitle = new Map<string, Superlative[]>();
  for (const item of source) {
    const list = byTitle.get(item.title) ?? [];
    list.push(item);
    byTitle.set(item.title, list);
  }
  const titles = [
    ...ORDER,
    ...[...byTitle.keys()].filter((title) => !ORDER.includes(title)),
  ];
  const weeks = [
    ...new Set(
      matchups.filter((m) => m.status === "final").map((m) => m.week),
    ),
  ].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">
          {league.season} SEASON
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
          Superlatives
        </h1>
        <p className="mt-1 text-sm text-muted">
          Weekly awards, grouped by superlative. Definitions appear on hover.
        </p>
      </div>

      <div className="space-y-10">
        {titles.map((title) => {
          const awards = [...(byTitle.get(title) ?? [])].sort(
            (a, b) => a.week - b.week,
          );
          const description =
            awards[0]?.description ??
            "No award has been recorded for this superlative yet.";
          const emoji = EMOJI[title] ?? awards[0]?.emoji ?? "🏆";
          const hasWeeklyHistory = WEEKLY_HISTORY_TITLES.has(title);

          return (
            <section key={title}>
              <div className="group relative mb-3 flex items-center gap-3 border-b border-hairline pb-3">
                <span className="text-2xl">{emoji}</span>
                <h2
                  className="font-display text-lg font-semibold text-ink"
                  title={description}
                >
                  {title}
                </h2>
                <span className="ml-auto font-mono text-xs text-faint">
                  {hasWeeklyHistory ? weeks.length : awards.length} weeks
                </span>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-80 rounded-lg border border-hairline bg-card-raised p-3 text-xs leading-relaxed text-muted shadow-card group-hover:block"
                >
                  {description}
                </div>
              </div>

              {hasWeeklyHistory ? (
                <div className="divide-y divide-hairline rounded-xl border border-hairline bg-card">
                  {weeks.map((week) => {
                    const award = awards.find((item) => item.week === week);
                    const team = award
                      ? teamById(teams, award.teamId)
                      : undefined;

                    return (
                      <div
                        key={week}
                        className="flex items-center gap-4 px-4 py-3"
                      >
                        <span className="w-16 shrink-0 font-mono text-xs text-faint">
                          WEEK {week}
                        </span>
                        {team && (
                          <>
                            <TeamBadge team={team} size="md" />
                            <span className="truncate text-sm text-ink">
                              {team.name}
                            </span>
                          </>
                        )}
                        <span className="ml-auto text-right text-xs text-muted">
                          {award?.value ?? "N/A"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : awards.length ? (
                <div className="divide-y divide-hairline rounded-xl border border-hairline bg-card">
                  {awards.map((award) => {
                    const team = teamById(teams, award.teamId);
                    return (
                      <div
                        key={award.id}
                        className="flex items-center gap-4 px-4 py-3"
                      >
                        <span className="w-16 shrink-0 font-mono text-xs text-faint">
                          WEEK {award.week}
                        </span>
                        <TeamBadge team={team} size="md" />
                        <span className="truncate text-sm text-ink">
                          {team?.name ?? "Unknown"}
                        </span>
                        <span className="ml-auto shrink-0 text-right font-mono text-xs text-muted">
                          {award.value}
                        </span>
                      </div>
                    );
                  })}
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
