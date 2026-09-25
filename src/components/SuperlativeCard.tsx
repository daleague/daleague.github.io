import type { Superlative, Team } from "@/types/league";
import { TeamBadge } from "./TeamBadge";

interface SuperlativeCardProps {
  superlative: Superlative;
  team: Team | undefined;
}

export function SuperlativeCard({ superlative, team }: SuperlativeCardProps) {
  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-hairline bg-card p-4 transition hover:border-gold/30">
      <span className="text-2xl leading-none">{superlative.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="relative inline-flex max-w-full">
          <p
            className="font-display text-xs font-semibold tracking-wide text-faint underline decoration-dotted decoration-faint/60 underline-offset-4"
            title={superlative.description}
          >
            {superlative.title}
          </p>
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-lg border border-hairline bg-card-raised p-3 text-xs leading-relaxed text-muted shadow-card group-hover:block"
          >
            {superlative.description}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <TeamBadge team={team} size="sm" />
          <span className="truncate text-sm text-ink">{team?.name ?? "Unknown"}</span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-xs text-muted">{superlative.value}</span>
    </div>
  );
}
