import { useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";

export function PowerRankings() {
  const { league, teams, standings, matchups } = useOutletContext<LeagueBundle>();
  const hasResults = matchups.some((m) => m.status === "final");
  const rows = [...standings].sort((a, b) => {
    const ag = a.wins + a.losses + a.ties, bg = b.wins + b.losses + b.ties;
    return (bg ? b.pointsFor / bg : 0) - (ag ? a.pointsFor / ag : 0) || b.winPct - a.winPct || a.teamId.localeCompare(b.teamId);
  });
  return <div className="space-y-6"><div><p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">{league.season} SEASON</p><h1 className="mt-1 font-display text-3xl font-semibold text-ink">Power Rankings</h1><p className="mt-1 text-sm text-muted">Sorted by points per completed game, with win percentage as the tiebreaker. This is a descriptive ranking, not a Yahoo projection.</p></div>{!hasResults ? <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-8 text-center text-sm text-muted">Rankings appear after completed matchups are available.</div> : <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">{rows.map((row, i) => { const team = teamById(teams, row.teamId); const games = row.wins + row.losses + row.ties; return <div key={row.teamId} className="flex items-center gap-4 px-5 py-4"><span className="score-num w-8 text-xl text-faint">#{i + 1}</span><TeamBadge team={team} size="md"/><div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold text-ink">{team?.name ?? "Unknown"}</p><p className="text-xs text-faint">{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ""} · {(games ? row.pointsFor / games : 0).toFixed(1)} pts/game</p></div><span className="score-num text-lg text-gold">{row.pointsFor.toFixed(1)}</span></div>;})}</div>}</div>;
}