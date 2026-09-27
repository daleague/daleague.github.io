import type { PlayerScore } from "@/types/league";

const SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "W/R/T", "DEF", "K", "BN", "IR", "IR+", "NA"];

export function bySlotOrder(a: PlayerScore, b: PlayerScore): number {
  const ai = SLOT_ORDER.indexOf(a.slot);
  const bi = SLOT_ORDER.indexOf(b.slot);
  return (ai === -1 ? SLOT_ORDER.length : ai) - (bi === -1 ? SLOT_ORDER.length : bi) || b.points - a.points;
}

export function RosterTable({
  label,
  players,
  empty = "No players in this group.",
}: {
  label: string;
  players: PlayerScore[];
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
      <div className="border-b border-hairline px-4 py-3 font-display text-sm text-ink">{label}</div>
      {players.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left font-display text-[11px] tracking-wider text-faint">
              <th className="px-4 py-2 font-semibold">Slot</th>
              <th className="px-4 py-2 font-semibold">Player</th>
              <th className="px-4 py-2 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId} className="border-b border-hairline/60 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-faint">{p.slot}</td>
                <td className="px-4 py-2 text-ink">
                  <div className="flex items-center gap-2">
                    {p.headshotUrl ? <img src={p.headshotUrl} alt="" className="h-9 w-9 rounded-full object-cover bg-card-raised" loading="lazy" /> : <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card-raised text-[10px] text-faint" aria-hidden="true">{p.actualPosition?.slice(0, 2) ?? "—"}</span>}
                    <span>{p.name}{p.nflTeam && <span className="ml-2 text-xs text-faint">{p.nflTeam}</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-ink">{p.points.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
