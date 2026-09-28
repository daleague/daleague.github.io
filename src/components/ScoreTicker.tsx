import type { Matchup, PlayerScore, Team } from "@/types/league";
import { teamById } from "@/lib/teams";

interface ScoreTickerProps {
  matchups: Matchup[];
  teams: Team[];
}

const TERMINAL_PLAYER_STATES = new Set(["final", "bye"]);

export function isMatchupFinal(matchup: Matchup): boolean {
  if (matchup.status === "final") return true;

  const starters = [...matchup.home.players, ...matchup.away.players].filter(
    (player) => player.isStarter,
  );
  const knownStatuses = starters.filter((player) => player.gameStatus != null);
  if (knownStatuses.length === 0) return false;

  return starters.every(
    (player) =>
      player.gameStatus != null &&
      TERMINAL_PLAYER_STATES.has(player.gameStatus),
  );
}

function displayWinnerTeamId(matchup: Matchup, isFinal: boolean): string | null {
  if (!isFinal) return matchup.winnerTeamId;
  if (matchup.winnerTeamId) return matchup.winnerTeamId;
  if (matchup.home.score > matchup.away.score) return matchup.home.teamId;
  if (matchup.away.score > matchup.home.score) return matchup.away.teamId;
  return null;
}

export function ScoreTicker({ matchups, teams }: ScoreTickerProps) {
  if (matchups.length === 0) return null;

  // Duplicated once so the CSS translateX(-50%) loop reads as seamless.
  const items = [...matchups, ...matchups];

  return (
    <div className="relative overflow-hidden border-y border-hairline bg-surface/80 backdrop-blur">
      <div className="flex w-max animate-ticker py-2.5">
        {items.map((matchup, i) => {
          const home = teamById(teams, matchup.home.teamId);
          const away = teamById(teams, matchup.away.teamId);
          const isFinal = isMatchupFinal(matchup);
          const winnerTeamId = displayWinnerTeamId(matchup, isFinal);
          const isLive = !isFinal && matchup.status === "live";

          return (
            <div
              key={`${matchup.matchupId}-${i}`}
              className="flex items-center gap-2.5 whitespace-nowrap border-r border-hairline/70 px-6 text-sm"
            >
              {isLive && (
                <span className="flex items-center gap-1 font-display text-[11px] font-semibold tracking-wider text-live">
                  <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-dot" />
                  LIVE
                </span>
              )}
              <span
                className={
                  winnerTeamId === away?.teamId
                    ? "font-semibold text-ink"
                    : "text-muted"
                }
              >
                {away?.name ?? "TBD"}
              </span>
              <span
                className={
                  winnerTeamId === away?.teamId
                    ? "font-semibold text-ink"
                    : "font-mono text-muted"
                }
              >
                {matchup.away.score.toFixed(1)}
              </span>
              <span className="text-faint">–</span>
              <span
                className={
                  winnerTeamId === home?.teamId
                    ? "font-semibold text-ink"
                    : "font-mono text-muted"
                }
              >
                {matchup.home.score.toFixed(1)}
              </span>
              <span
                className={
                  winnerTeamId === home?.teamId
                    ? "font-semibold text-ink"
                    : "text-muted"
                }
              >
                {home?.name ?? "TBD"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
