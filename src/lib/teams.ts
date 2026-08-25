import type { Team } from "@/types/league";

export function teamById(teams: Team[], teamId: string): Team | undefined {
  return teams.find((t) => t.teamId === teamId);
}
