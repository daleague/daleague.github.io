/**
 * Conservative guards for start/sit analysis.
 * We only suppress a bench player when the supplied Yahoo data has a known
 * bye, availability, or injury signal; unknown status is not treated as proof.
 */
type PlayerAvailability = Record<string, unknown>;

export function hasKnownLineupUnavailability(player: PlayerAvailability): boolean {
  const gameStatus = String(player.gameStatus ?? player.game_status ?? player.player_game_status ?? "").trim().toLowerCase();
  if (gameStatus === "bye" || /\bbye\b/.test(gameStatus)) return true;

  const availabilityStatus = [
    player.availabilityStatus,
    player.status,
    player.statusFull,
    player.status_full,
    player.playerStatus,
    player.player_status,
    player.injuryStatus,
    player.injury_status,
  ]
    .filter((value) => value != null && String(value).trim())
    .map((value) => String(value).trim().toLowerCase())
    .join(" / ");

  if (/\b(?:q|questionable|d|doubtful|o|out|ir|injured reserve|pup|physically unable to perform|nfi|non-football injury|susp|suspended|inactive|dnp|did not play|not active)\b/i.test(availabilityStatus)) {
    return true;
  }

  const injuryNote = String(player.injuryNote ?? player.injury_note ?? "").trim();
  return Boolean(injuryNote && !/^(?:none|no injury|n\/?a|healthy|active|[-—])$/i.test(injuryNote));
}
