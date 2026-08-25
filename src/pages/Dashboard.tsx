import { useParams, useOutletContext } from "react-router-dom";
import type { LeagueBundle } from "@/hooks/useLeagueData";
import { teamById } from "@/lib/teams";
import { ScoreTicker } from "@/components/ScoreTicker";
import { MatchupCard } from "@/components/MatchupCard";
import { WeekSelector } from "@/components/WeekSelector";
import { SuperlativeCard } from "@/components/SuperlativeCard";

export function Dashboard() {
  const { league, teams, matchups, superlatives } = useOutletContext<LeagueBundle>();
  const params = useParams<{ week?: string }>();

  const requestedWeek = params.week ? Number(params.week) : league.currentWeek;
  const availableWeeks = [...league.completedWeeks, league.currentWeek].sort((a, b) => a - b);
  const isFutureWeek = requestedWeek > league.currentWeek;
  const weekMatchups = matchups.filter((m) => m.week === requestedWeek);
  const isCurrentWeek = requestedWeek === league.currentWeek;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-faint">
            {league.season} SEASON
          </p>
          <h1 className="score-num text-6xl text-ink sm:text-7xl">
            WEEK <span className="text-gold">{requestedWeek}</span>
          </h1>
        </div>
        {isCurrentWeek && weekMatchups.some((m) => m.status === "live") && (
          <span className="flex items-center gap-2 font-display text-sm tracking-wide text-live">
            <span className="h-2 w-2 rounded-full bg-live animate-pulse-dot" />
            GAMES IN PROGRESS
          </span>
        )}
      </div>

      <WeekSelector weeks={availableWeeks} currentWeek={league.currentWeek} selectedWeek={requestedWeek} />

      {isCurrentWeek && <ScoreTicker matchups={weekMatchups} teams={teams} />}

      {isFutureWeek ? (
        <EmptyState
          title="This week hasn't happened yet"
          body={`Matchups will appear here once Week ${requestedWeek} kicks off.`}
        />
      ) : weekMatchups.length === 0 ? (
        <EmptyState
          title="No snapshot for this week yet"
          body="Historical weekly snapshots are saved automatically once a week is complete. Check back after the next data refresh."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {weekMatchups.map((m) => (
            <MatchupCard key={m.matchupId} matchup={m} homeTeam={teamById(teams, m.home.teamId)} awayTeam={teamById(teams, m.away.teamId)} />
          ))}
        </div>
      )}

      {isCurrentWeek && superlatives.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-[0.25em] text-faint">
            WEEK {requestedWeek} SUPERLATIVES
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {superlatives.map((s) => (
              <SuperlativeCard key={s.id} superlative={s} team={teamById(teams, s.teamId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-card/40 p-10 text-center">
      <p className="font-display text-sm font-semibold tracking-wide text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}
