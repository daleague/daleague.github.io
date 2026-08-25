import { useState } from "react";
import type { Team } from "@/types/league";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-11 w-11 text-xs",
  lg: "h-16 w-16 text-base",
} as const;

interface TeamBadgeProps {
  team: Team | undefined;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function TeamBadge({ team, size = "md", className = "" }: TeamBadgeProps) {
  const [broken, setBroken] = useState(false);
  const name = team?.name ?? "Unknown Team";
  const showFallback = !team?.iconUrl || broken;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-raised ring-1 ring-hairline ${SIZE_CLASSES[size]} ${className}`}
      title={name}
    >
      {showFallback ? (
        <span className="font-display font-semibold tracking-wide text-muted">{initials(name)}</span>
      ) : (
        <img
          src={team!.iconUrl!}
          alt={`${name} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}
