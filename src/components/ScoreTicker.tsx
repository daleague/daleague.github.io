import type { Matchup, Team } from "@/types/league";
import { teamById } from "@/lib/teams";

interface ScoreTickerProps {
  matchups: Matchup[];
  teams: Team[];
}

export function ScoreTicker({ matchups, teams }: ScoreTickerProps) {
  if (matchups.length === 0) return null;

  // Duplicated once so the CSS translateX(-50%) loop reads as seamless.
  const items = [...matchups, ...matchups];

  return (
    <div className="relative overflow-hidden border-y border-hairline bg-surface/80 backdrop-blur">
      <div className="flex w-max animate-ticker py-2.5">
        {items.map((m, i) => {
          const home = teamById(teams, m.home.teamId);
          const away = teamById(teams, m.away.teamId);
          return (
            <div
              key={`${m.matchupId}-${i}`}
              className="flex items-center gap-2.5 whitespace-nowrap border-r border-hairline/70 px-6 text-sm"
            >
              {m.status === "live" && (
                <span className="flex items-center gap-1 font-display text-[11px] font-semibold tracking-wider text-live">
                  <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-dot" />
                  LIVE
                </span>
              )}
              <span className={m.winnerTeamId === away?.teamId ? "font-semibold text-ink" : "text-muted"}>
                {away?.name ?? "TBD"}
              </span>
              <span className="font-mono text-muted">{m.away.score.toFixed(1)}</span>
              <span className="text-faint">–</span>
              <span className="font-mono text-muted">{m.home.score.toFixed(1)}</span>
              <span className={m.winnerTeamId === home?.teamId ? "font-semibold text-ink" : "text-muted"}>
                {home?.name ?? "TBD"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
