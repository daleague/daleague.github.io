import type { Superlative, Team } from "@/types/league";
import { TeamBadge } from "./TeamBadge";

interface SuperlativeCardProps {
  superlative: Superlative;
  team: Team | undefined;
}

export function SuperlativeCard({ superlative, team }: SuperlativeCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-card p-4 transition hover:border-gold/30">
      <span className="text-2xl leading-none">{superlative.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs font-semibold tracking-wide text-faint">{superlative.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <TeamBadge team={team} size="sm" />
          <span className="truncate text-sm text-ink">{team?.name ?? "Unknown"}</span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-xs text-muted">{superlative.value}</span>
    </div>
  );
}
