import type { Team } from "@/types/league";

function shortId(teamId: string): string {
  const keyed = teamId.match(/\.t\.(\d+)\s*$/);
  return keyed ? keyed[1] : teamId;
}

export function teamById(teams: Team[], teamId: string | undefined): Team | undefined {
  if (!teamId) return undefined;
  const wanted = shortId(teamId);
  return teams.find((t) => t.teamId === teamId || t.teamId === wanted || shortId(t.teamId) === wanted);
}