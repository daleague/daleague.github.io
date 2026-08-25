import { useEffect, useState } from "react";
import { fetchJson } from "@/data/dataSource";
import type { League, Team, TeamStanding, Matchup, Superlative } from "@/types/league";

export interface LeagueBundle {
  league: League;
  teams: Team[];
  standings: TeamStanding[];
  matchups: Matchup[];
  superlatives: Superlative[];
}

interface UseLeagueDataResult {
  data: LeagueBundle | null;
  loading: boolean;
  error: string | null;
}

export function useLeagueData(): UseLeagueDataResult {
  const [data, setData] = useState<LeagueBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [league, teams, standings, matchups, superlatives] = await Promise.all([
          fetchJson<League>("league.json"),
          fetchJson<Team[]>("teams.json"),
          fetchJson<TeamStanding[]>("standings.json"),
          fetchJson<Matchup[]>("matchups-current.json"),
          fetchJson<Superlative[]>("superlatives-current.json"),
        ]);
        if (!cancelled) {
          setData({ league, teams, standings, matchups, superlatives });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load league data.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
