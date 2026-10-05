import type { League } from "@/types/league";

interface LastUpdatedProps {
  league: League;
  className?: string;
}

export function LastUpdated({ league, className = "" }: LastUpdatedProps) {
  const updatedAt = new Date(league.lastUpdatedAt);

  if (Number.isNaN(updatedAt.getTime())) return null;

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: league.timezone || "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(updatedAt);

  return (
    <p className={`font-mono text-[11px] tracking-wide text-faint ${className}`}>
      LAST UPDATED · {formatted}
    </p>
  );
}
