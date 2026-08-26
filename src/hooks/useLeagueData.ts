import { useEffect, useState } from "react";
import { fetchJson } from "@/data/dataSource";
import type { League, Team, TeamStanding, Matchup, Superlative } from "@/types/league";
import type { Transaction } from "@/types/transaction";

export interface LeagueBundle {
  league: League;
  teams: Team[];
  standings: TeamStanding[];
  matchups: Matchup[];
  superlatives: Superlative[];
  transactions: Transaction[];
}

interface UseLeagueDataResult {
  data: LeagueBundle | null;
  loading: boolean;
  error: string | null;
}

async function fetchOptional<T>(file: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(file);
  } catch {
    return fallback;
  }
}

export function useLeagueData(): UseLeagueDataResult {
  const [data, setData] = useState<LeagueBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [league, teams, standings, matchups, superlatives, history, transactions] = await Promise.all([
          fetchJson<League>("league.json"),
          fetchJson<Team[]>("teams.json"),
          fetchJson<TeamStanding[]>("standings.json"),
          fetchJson<Matchup[]>("matchups-current.json"),
          fetchJson<Superlative[]>("superlatives-current.json"),
          fetchOptional<Matchup[]>("matchups-history.json", []),
          fetchOptional<Transaction[]>("transactions.json", []),
        ]);

        if (!cancelled) {
          setData({
            league,
            teams,
            standings,
            matchups: history.length ? history : matchups,
            superlatives,
            transactions,
          });
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
