import { describe, expect, it } from "vitest";
import {
  mergeYahooRecord,
  nestedTotal,
  normalizeTeamId,
  pointsFrom,
  recordsWithKey,
} from "./yahooJson";

const scoreboardTeam = {
  team: [
    [
      { team_key: "470.l.344338.t.1" },
      { team_id: "1" },
      { name: "Muslim McCaffrey" },
      [],
      { managers: { manager: { nickname: "Sameer", manager_id: "1" } } },
    ],
    { team_points: [{ coverage_type: "week" }, { week: "1" }, { total: "142.18" }] },
    { team_projected_points: { coverage_type: "week", week: "1", total: 125.4 } },
    { win_probability: 0.62 },
  ],
};

describe("yahoo JSON merge", () => {
  it("merges nested team bags with sibling team_points", () => {
    const teams = recordsWithKey(scoreboardTeam, "team_key");
    expect(teams).toHaveLength(1);
    expect(normalizeTeamId(teams[0].team_key, teams[0].team_id)).toBe("1");
    expect(teams[0].name).toBe("Muslim McCaffrey");
    expect(pointsFrom(teams[0], "team_points")).toBeCloseTo(142.18);
    expect(nestedTotal(teams[0].team_projected_points)).toBeCloseTo(125.4);
    expect(teams[0].win_probability).toBe(0.62);
  });

  it("merges standings outcome_totals and points_for", () => {
    const raw = {
      team: [
        [{ team_key: "470.l.344338.t.6" }, { team_id: "6" }, { name: "Allen Wrenches" }],
        {
          team_standings: [
            { rank: "1" },
            { outcome_totals: [{ wins: "2" }, { losses: "0" }, { ties: "0" }, { percentage: "1.000" }] },
            { points_for: "251.30" },
            { points_against: "210.70" },
            { streak: { type: "win", value: "2" } },
          ],
        },
      ],
    };
    const teams = recordsWithKey(raw, "team_key");
    const merged = mergeYahooRecord(teams[0].team_standings);
    expect(merged.rank).toBe("1");
    expect(mergeYahooRecord(merged.outcome_totals).wins).toBe("2");
    expect(merged.points_for).toBe("251.30");
  });

  it("keeps selected_position and player_points on roster players", () => {
    const raw = {
      player: [
        [
          { player_key: "470.p.32723" },
          { player_id: "32723" },
          { name: { full: "Jalen Hurts" } },
          { display_position: "QB" },
          { eligible_positions: { position: ["QB"] } },
        ],
        { selected_position: [{ coverage_type: "week" }, { week: "3" }, { position: "QB" }] },
        { player_points: [{ coverage_type: "week" }, { week: "3" }, { total: "24.6" }] },
      ],
    };
    const players = recordsWithKey(raw, "player_key");
    expect(players).toHaveLength(1);
    const mergedPos = mergeYahooRecord(players[0].selected_position);
    expect(mergedPos.position).toBe("QB");
    expect(pointsFrom(players[0], "player_points")).toBeCloseTo(24.6);
  });

  it("normalizes full team keys to short ids", () => {
    expect(normalizeTeamId("470.l.344338.t.12", "12")).toBe("12");
    expect(normalizeTeamId("470.l.344338.t.2")).toBe("2");
    expect(normalizeTeamId("", "7")).toBe("7");
  });
});
