import { describe, expect, it } from "vitest";
import type { Matchup, Team } from "@/types/league";
import { calculatePowerRankings } from "./PowerRankings";

const teams: Team[] = ["1", "2", "3", "4"].map((teamId) => ({
  teamId,
  name: `Team ${teamId}`,
  iconUrl: null,
}));

function matchup(
  week: number,
  homeTeamId: string,
  homeScore: number,
  awayTeamId: string,
  awayScore: number,
): Matchup {
  return {
    matchupId: `2026-${week}-${homeTeamId}-${awayTeamId}`,
    season: 2026,
    week,
    status: "final",
    home: { teamId: homeTeamId, score: homeScore, players: [] },
    away: { teamId: awayTeamId, score: awayScore, players: [] },
    winnerTeamId:
      homeScore === awayScore
        ? null
        : homeScore > awayScore
          ? homeTeamId
          : awayTeamId,
  };
}

describe("calculatePowerRankings", () => {
  it("lets scoring strength and decisive margins outweigh a worse record", () => {
    const matchups = [
      matchup(1, "1", 180, "3", 60),
      matchup(1, "2", 120, "4", 110),
      matchup(2, "3", 170, "1", 160),
      matchup(2, "2", 120, "4", 115),
    ];

    const rankings = calculatePowerRankings(teams, matchups, 2);
    const teamA = rankings.find((row) => row.teamId === "1")!;
    const teamB = rankings.find((row) => row.teamId === "2")!;

    expect(teamA.wins).toBe(1);
    expect(teamB.wins).toBe(2);
    expect(teamA.pointsPerGame).toBe(170);
    expect(teamA.averageMargin).toBe(55);
    expect(teamA.rating).toBeGreaterThan(teamB.rating);
    expect(rankings[0].teamId).toBe("1");
  });

  it("uses the current streak as a distinct momentum component", () => {
    const matchups = [
      matchup(1, "1", 120, "2", 100),
      matchup(1, "3", 110, "4", 90),
      matchup(2, "1", 130, "4", 90),
      matchup(2, "2", 125, "3", 100),
      matchup(3, "1", 140, "3", 100),
      matchup(3, "2", 120, "4", 110),
    ];

    const rankings = calculatePowerRankings(teams, matchups, 3);
    const teamA = rankings.find((row) => row.teamId === "1")!;
    const teamB = rankings.find((row) => row.teamId === "2")!;

    expect(teamA.streak).toEqual({ type: "W", count: 3 });
    expect(teamB.streak).toEqual({ type: "L", count: 1 });
    expect(teamA.components.stk).toBe(0.8);
    expect(teamB.components.stk).toBe(0.4);
  });

  it("calculates all-play percentage across every completed week", () => {
    const matchups = [
      matchup(1, "1", 140, "2", 100),
      matchup(1, "3", 90, "4", 80),
      matchup(2, "1", 100, "3", 95),
      matchup(2, "2", 110, "4", 90),
    ];

    const rankings = calculatePowerRankings(teams, matchups, 2);
    const teamA = rankings.find((row) => row.teamId === "1")!;

    // Week 1: beat teams 2, 3, 4 -> 3-0.
    // Week 2: beat teams 3, 4 and lose to team 2 -> 2-1.
    expect(teamA.allPlayPct).toBeCloseTo(5 / 6);
    expect(teamA.components.awp).toBeCloseTo(5 / 6);
  });

  it("caps streaks at five games in either direction", () => {
    const matchups: Matchup[] = [];
    for (let week = 1; week <= 6; week += 1) {
      matchups.push(matchup(week, "1", 130, String((week % 3) + 2), 80));
      matchups.push(matchup(week, "2", 120, "4", 110));
    }

    const rankings = calculatePowerRankings(teams, matchups, 6);
    const teamA = rankings.find((row) => row.teamId === "1")!;

    expect(teamA.streak).toEqual({ type: "W", count: 6 });
    expect(teamA.components.stk).toBe(1);
  });
});
