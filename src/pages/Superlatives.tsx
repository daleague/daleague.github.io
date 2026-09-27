import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { Superlative, Matchup } from "@/types/league";
import type { Team } from "@/types/league";
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
  "Explosion": "💣",
  "Trending Up": "📈",
  "Trending Down": "📉",
  "Donkey of the Week": "🫏",
};

// Validates a donkey entry: the team must be a loser, and adding the bench player's points
// must turn the loss into a win. Returns the display value or null if invalid.
function validateDonkeyEntry(superlative: Superlative, matchups: Matchup[], teams: Team[]): string | null {
  const matchup = matchups.find((m) => m.matchupId === superlative.matchupId);
  if (!matchup) return null;

  // Find the team represented by this superlative
  const team = teamById(teams, superlative.teamId);
  if (!team) return null;

  // The donkey must be a losing team
  const losingMatchup = matchup.status === "final" && matchup.winnerTeamId !== team.teamId;
  if (!losingMatchup) return null;

  // Find the team's matchup side (home or away) and compute scores
  const teamSide = matchup.home.teamId === team.teamId ? "home" : "away";
  const homeScore = matchup.home.score;
  const awayScore = matchup.away.score;
  const teamScore = teamSide === "home" ? homeScore : awayScore;
  const opponentScore = teamSide === "home" ? awayScore : homeScore;
  const wouldNewScore = teamScore + parseFloat(superlative.value);

  // Check if adding the bench player's points would turn the loss into a win
  if (wouldNewScore > opponentScore) {
    const margin = (wouldNewScore - opponentScore).toFixed(1);
    return `+${superlative.value} → would win by ${margin}`;
  }

  // If adding the points doesn't result in a win, it's not a valid donkey
  return null;
}

export function Superlatives() {
  const { league, teams, superlatives, superlativeHistory, matchups } = useOutletContext<LeagueBundle>();

  // Use superlative history if available, otherwise fall back to current superlatives
  const sourceSuperlatives = superlativeHistory.length
    ? superlativeHistory
    : superlatives;

  const byTitle = new Map<string, typeof sourceSuperlatives>();
  for (const superlative of sourceSuperlatives) {
    const existing = byTitle.get(superlative.title) ?? [];
    existing.push(superlative);
    byTitle.set(superlative.title, existing);
  }

  const titles = [
    ...SUPERLATIVE_ORDER,
    ...[...byTitle.keys()].filter((title) => !SUPERLATIVE_ORDER.includes(title)),
  ];

  // Validate donkey of the week entries
  const donkeyEntry = byTitle.get("Donkey of the Week")?.[0];
  const validatedDonkey = donkeyEntry
    ? validateDonkeyEntry(donkeyEntry, matchups, teams)
    : null;

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
          const awards = [...(byTitle.get(title) ?? [])].sort((a, b) => a.week - b.week);
          const description = awards[0]?.description ?? "No award has been recorded for this superlative yet.";
          const emoji = SUPERLATIVE_EMOJIS[title] ?? awards[0]?.emoji ?? "🏆";

          // Handle N/A for week 1 trending up/down (no prior week to compare)
          let displayDescription = description;
          if ((title === "Trending Up" || title === "Trending Down") && awards[0]?.week === 1) {
            displayDescription = "N/A";
          }

          // Special handling for Donkey of the Week: show validated donkey or N/A
          if (title === "Donkey of the Week") {
            return (
              <section key={title}>
                <div className="group relative mb-3 flex items-end justify-between border-b border-hairline pb-3">
                  <div className="relative flex items-center gap-3">
                    <span className="text-2xl">{SUPERLATIVE_EMOJIS[title]}</span>
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
                        {validatedDonkey ?? "N/A"}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-faint">1 week</span>
                </div>

                {validatedDonkey ? (
                  <div className="divide-y divide-hairline rounded-xl border border-hairline bg-card">
                    <div className="flex items-center gap-4 px-4 py-3">
                      <span className="w-16 shrink-0 font-mono text-xs font-semibold tracking-wider text-faint">
                        DONKEY OF THE WEEK
                      </span>
                      <TeamBadge team={teamById(teams, donkeyEntry?.teamId)} size="md" />
                      <span className="truncate text-sm text-ink">
                        {teamById(teams, donkeyEntry?.teamId)?.name ?? "Unknown"}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted">
                        {validatedDonkey}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-hairline bg-card/40 p-6 text-sm text-muted">
                    No donkey of the week (no bench player would have changed the outcome).
                  </div>
                )}
              </section>
            );
          }

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
                      {displayDescription}
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
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted">{superlative.value}</span>
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