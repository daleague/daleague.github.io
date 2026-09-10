import type { ManagerProfile as ManagerProfileData } from "@/types/league";

interface ManagerProfileProps {
  manager: ManagerProfileData | undefined;
  compact?: boolean;
}

function formatRecord(manager: ManagerProfileData): string {
  return `${manager.wins}-${manager.losses}${manager.ties ? `-${manager.ties}` : ""}`;
}

function formatWinPct(value: number | null): string {
  return value == null ? "—" : value.toFixed(3).replace(/^0/, "");
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="font-display text-[10px] font-semibold tracking-[0.16em] text-faint">{label}</p>
      <p className="mt-1 font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

export function ManagerProfile({ manager, compact = false }: ManagerProfileProps) {
  if (!manager) return null;

  if (compact) {
    return (
      <div className="mt-3 rounded-xl border border-hairline/80 bg-card-raised/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[10px] font-semibold tracking-[0.16em] text-faint">MANAGER</p>
            <p className="mt-1 truncate font-display text-sm font-semibold text-ink">{manager.managerName}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-gold">{manager.rating ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-faint">rating</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="LEVEL" value={manager.level ?? "—"} />
          <Stat label="RECORD" value={formatRecord(manager)} />
          <Stat label="WIN %" value={formatWinPct(manager.winPct)} />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-hairline bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold tracking-[0.25em] text-faint">MANAGER PROFILE</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{manager.managerName}</h2>
          <p className="mt-1 text-xs text-muted">{manager.level ?? "Level unavailable"} · {manager.rating ?? "—"} rating</p>
        </div>
        {manager.profileUrl && (
          <a
            href={manager.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="font-display text-xs font-semibold tracking-wide text-gold underline underline-offset-2 hover:text-ink"
          >
            View Profile ↗
          </a>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="CURRENT RATING" value={manager.rating?.toString() ?? "—"} />
        <Stat label="LEVEL" value={manager.level ?? "—"} />
        <Stat label="RECORD" value={formatRecord(manager)} />
        <Stat label="WINNING %" value={formatWinPct(manager.winPct)} />
        <Stat label="TROPHIES WON" value={manager.trophiesWon.toString()} />
        <Stat label="1ST PLACE" value={manager.firstPlaceTrophies.toString()} />
        <Stat label="BEST FINISH" value={manager.bestSeasonFinish ?? "—"} />
        <Stat label="PLAYING SINCE" value={manager.playingSince?.toString() ?? "—"} />
        <Stat label="TEAMS MANAGED" value={manager.teamsManaged.toString()} />
      </div>
    </section>
  );
}

export function ManagerComparison({ left, right }: { left?: ManagerProfileData; right?: ManagerProfileData }) {
  if (!left && !right) return null;

  const rows: Array<{ label: string; key: keyof ManagerProfileData; format?: (value: unknown) => string }> = [
    { label: "Level", key: "level" },
    { label: "Current Rating", key: "rating" },
    { label: "Record (W-L-T)", key: "wins", format: () => (left ? formatRecord(left) : "—") },
    { label: "Winning %", key: "winPct", format: (value) => formatWinPct(value as number | null) },
    { label: "Trophies Won", key: "trophiesWon" },
    { label: "First Place Trophies", key: "firstPlaceTrophies" },
    { label: "Best Season Finish", key: "bestSeasonFinish" },
    { label: "Playing Since", key: "playingSince" },
    { label: "Teams Managed", key: "teamsManaged" },
  ];

  const valueFor = (manager: ManagerProfileData | undefined, row: (typeof rows)[number]) => {
    if (!manager) return "—";
    if (row.label === "Record (W-L-T)") return formatRecord(manager);
    const value = manager[row.key];
    return row.format ? row.format(value) : String(value ?? "—");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
      <div className="border-b border-hairline px-5 py-4 sm:px-6">
        <p className="font-display text-xs font-semibold tracking-[0.25em] text-faint">MANAGER COMPARISON</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-hairline bg-card-raised/30 px-4 py-3 sm:px-6">
        <div className="pr-3 font-display text-sm font-semibold text-ink">{left?.managerName ?? "Unknown"}</div>
        <div className="px-2 font-display text-[10px] tracking-widest text-faint">VS</div>
        <div className="pl-3 text-right font-display text-sm font-semibold text-ink">{right?.managerName ?? "Unknown"}</div>
      </div>
      <div>
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-hairline/60 px-4 py-3 last:border-0 sm:px-6">
            <div className="pr-3 font-mono text-sm text-ink">{valueFor(left, row)}</div>
            <div className="px-2 text-center font-display text-[10px] font-semibold tracking-wider text-faint">{row.label}</div>
            <div className="pl-3 text-right font-mono text-sm text-ink">{valueFor(right, row)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
