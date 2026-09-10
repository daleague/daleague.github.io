import { Link, useOutletContext, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import type { Matchup } from "@/types/league";
import { IS_MANAGER_PROFILE_ENABLED } from "@/data/dataSource";
import { teamById } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";
import { ManagerProfile } from "@/components/ManagerProfile";

export function TeamPage() {
  const { teams, standings, matchups, transactions, managerProfiles } = useOutletContext<LeagueBundle>();
  const { teamId } = useParams<{ teamId: string }>();

  const team = teamId ? teamById(teams, teamId) : undefined;
  const standing = standings.find((s) => s.teamId === teamId);
  const managerProfile = team?.managerId
    ? managerProfiles.find((manager) => manager.managerId === team.managerId)
    : undefined;
  const teamMatchups = matchups
    .filter((m) => m.home.teamId === teamId || m.away.teamId === teamId)
    .sort((a, b) => b.week - a.week);
  const teamTransactions = transactions
    .filter((t) => t.teamId === teamId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const thisWeekMatchup = teamMatchups[0];

  if (!team || !standing) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
        <p className="font-display text-sm font-semibold text-ink">Team not found</p>
        <Link to="/standings" className="mt-2 inline-block text-sm text-gold underline underline-offset-2">
          Back to standings
        </Link>
      </div>
    );
  }

  const games = standing.wins + standing.losses + standing.ties;
  const avgScore = games > 0 ? standing.pointsFor / games : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <TeamBadge team={team} size="lg" />
        <div>
          <p className="font-display text-xs tracking-[0.3em] text-faint">TEAM PROFILE</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{team.name}</h1>
          {team.managerName && <p className="text-sm text-muted">Managed by {team.managerName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Record" value={`${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`} />
        <Stat label="League Rank" value={`#${standing.rank}`} />
        <Stat label="Points For" value={standing.pointsFor.toFixed(1)} />
        <Stat label="Points Against" value={standing.pointsAgainst.toFixed(1)} />
        <Stat label="Avg / Week" value={avgScore.toFixed(1)} />
        <Stat label="Streak" value={`${standing.streak.type}${standing.streak.count}`} />
        <Stat label="Win %" value={`${(standing.winPct * 100).toFixed(0)}%`} />
        <Stat label="Playoff Status" value={standing.playoffStatus.toUpperCase()} />
      </div>

      {IS_MANAGER_PROFILE_ENABLED && managerProfile && <ManagerProfile manager={managerProfile} />}

      {thisWeekMatchup && (
        <section>
          <SectionTitle>THIS WEEK</SectionTitle>
          <div className="mt-3">
            <MatchupRow matchup={thisWeekMatchup} teamId={teamId!} teams={teams} />
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <SectionTitle>MATCHUP HISTORY</SectionTitle>
          <span className="text-xs text-faint">{teamMatchups.length} weeks</span>
        </div>
        {teamMatchups.length > 0 ? (
          <div className="space-y-2">
            {teamMatchups.map((matchup) => (
              <MatchupRow key={matchup.matchupId} matchup={matchup} teamId={teamId!} teams={teams} />
            ))}
          </div>
        ) : (
          <EmptyState text="Weekly matchup history will appear here once Yahoo data is connected." />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <SectionTitle>TRANSACTION HISTORY</SectionTitle>
          <span className="text-xs text-faint">{teamTransactions.length} transactions</span>
        </div>
        {teamTransactions.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-hairline bg-card shadow-card">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-display text-xs tracking-wider text-faint">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                  <th className="px-4 py-3 font-semibold">Dropped</th>
                  <th className="px-4 py-3 font-semibold text-right">FAAB</th>
                </tr>
              </thead>
              <tbody>
                {teamTransactions.map((transaction) => (
                  <tr key={transaction.transactionId} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-muted">
                      {new Date(transaction.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide text-ink">
                      {transaction.type}
                    </td>
                    <td className="px-4 py-3 text-muted">{transaction.playersAdded.map((p) => p.name).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-muted">{transaction.playersDropped.map((p) => p.name).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">
                      {transaction.faabAmount != null ? `$${transaction.faabAmount}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Transactions will appear here when the Yahoo ingestion pipeline starts publishing transaction data." />
        )}
      </section>
    </div>
  );
}

function MatchupRow({ matchup, teamId, teams }: { matchup: Matchup; teamId: string; teams: LeagueBundle["teams"] }) {
  const isHome = matchup.home.teamId === teamId;
  const own = isHome ? matchup.home : matchup.away;
  const opponent = isHome ? matchup.away : matchup.home;
  const opponentTeam = teamById(teams, opponent.teamId);
  const result = matchup.status === "final"
    ? matchup.winnerTeamId === teamId ? "W" : matchup.winnerTeamId ? "L" : "T"
    : matchup.status.toUpperCase();
  const resultClass = result === "W" ? "text-win" : result === "L" ? "text-live" : "text-gold";

  return (
    <Link
      to={`/matchup/${matchup.matchupId}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-hairline bg-card p-4 transition hover:border-gold/40"
    >
      <div className="text-center">
        <p className="font-display text-[10px] tracking-wider text-faint">WEEK</p>
        <p className="score-num text-lg text-ink">{matchup.week}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-faint">{isHome ? "vs." : "@"} {opponentTeam?.name ?? "Unknown team"}</p>
        <p className="mt-1 truncate font-display text-sm text-ink">
          {own.score.toFixed(1)} <span className="text-faint">—</span> {opponent.score.toFixed(1)}
        </p>
      </div>
      <span className={`font-display text-sm font-bold ${resultClass}`}>{result}</span>
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-sm font-semibold tracking-[0.25em] text-faint">{children}</h2>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-6 text-center text-sm text-muted">{text}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <p className="font-display text-[11px] tracking-wide text-faint">{label}</p>
      <p className="score-num mt-1 text-2xl text-ink">{value}</p>
    </div>
  );
}
