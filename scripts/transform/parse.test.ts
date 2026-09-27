import { describe, expect, it } from "vitest";
import type { Matchup, PlayerScore } from "../../src/types/league";
import {
  deriveStandings,
  findDonkey,
  makeSuperlatives,
  parseMatchups,
  parsePlayerScores,
  parseStandings,
  parseTeams,
  parseTransactions,
} from "./parse";

function side(teamId: string, score: number, players: PlayerScore[] = [], extra: Partial<Matchup["home"]> = {}): Matchup["home"] {
  return { teamId, score, players, ...extra };
}

function matchup(week: number, home: Matchup["home"], away: Matchup["home"], winnerTeamId: string | null, status: Matchup["status"] = "final"): Matchup {
  return {
    matchupId: `2026-${week}-${home.teamId}-${away.teamId}`,
    season: 2026,
    week,
    status,
    home,
    away,
    winnerTeamId,
  };
}

const scoreboard = {
  scoreboard: {
    week: "1",
    matchups: {
      count: 1,
      0: {
        matchup: [
          { week: "1" },
          { status: "postevent" },
          { winner_team_key: "470.l.344338.t.1" },
          {
            0: {
              team: [
                [{ team_key: "470.l.344338.t.1" }, { team_id: "1" }, { name: "Home" }],
                { team_points: [{ total: "142.18" }] },
                { team_projected_points: { total: "120.0" } },
                { win_probability: 0.71 },
              ],
            },
          },
          {
            1: {
              team: [
                [{ team_key: "470.l.344338.t.6" }, { team_id: "6" }, { name: "Away" }],
                { team_points: [{ total: "101.40" }] },
                { team_projected_points: { total: "118.0" } },
                { win_probability: 0.29 },
              ],
            },
          },
        ],
      },
    },
  },
};

describe("domain parsers", () => {
  it("parses matchup scores and short team ids from Yahoo scoreboard JSON", () => {
    const matchups = parseMatchups(scoreboard, 2026, 1);
    expect(matchups).toHaveLength(1);
    const m = matchups[0];
    expect(m.home.teamId).toBe("1");
    expect(m.away.teamId).toBe("6");
    expect(m.home.score).toBeCloseTo(142.18);
    expect(m.away.score).toBeCloseTo(101.4);
    expect(m.winnerTeamId).toBe("1");
    expect(m.status).toBe("final");
    expect(m.home.projectedScore).toBeCloseTo(120);
    expect(m.away.winProbability).toBeCloseTo(29);
  });

  it("parses standings W-L and points", () => {
    const raw = {
      standings: {
        teams: {
          0: {
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
          },
        },
      },
    };
    const standings = parseStandings(raw);
    expect(standings[0].teamId).toBe("6");
    expect(standings[0].wins).toBe(2);
    expect(standings[0].losses).toBe(0);
    expect(standings[0].pointsFor).toBeCloseTo(251.3);
    expect(standings[0].pointsAgainst).toBeCloseTo(210.7);
    expect(standings[0].streak).toEqual({ type: "W", count: 2 });
  });

  it("parses starter slots and player points", () => {
    const raw = {
      roster: {
        players: {
          0: {
            player: [
              [{ player_key: "470.p.1" }, { player_id: "1" }, { name: { full: "Jalen Hurts" } }, { display_position: "QB" }],
              { selected_position: [{ position: "QB" }] },
              { player_points: [{ total: "24.6" }] },
            ],
          },
          1: {
            player: [
              [{ player_key: "470.p.2" }, { player_id: "2" }, { name: { full: "Bench Bat" } }, { display_position: "RB" }],
              { selected_position: [{ position: "BN" }] },
              { player_points: [{ total: "18.0" }] },
            ],
          },
        },
      },
    };
    const players = parsePlayerScores(raw);
    const hurts = players.find((p) => p.playerId === "1")!;
    const bench = players.find((p) => p.playerId === "2")!;
    expect(hurts.slot).toBe("QB");
    expect(hurts.isStarter).toBe(true);
    expect(hurts.points).toBeCloseTo(24.6);
    expect(bench.slot).toBe("BN");
    expect(bench.isStarter).toBe(false);
  });

  it("classifies add/drop transactions and records dropped players", () => {
    const raw = {
      transactions: {
        0: {
          transaction: [
            { transaction_key: "470.l.344338.tr.100" },
            { type: "add/drop" },
            { timestamp: "1758900000" },
            { faab_bid: "5" },
            {
              players: {
                0: {
                  player: [
                    [{ player_key: "470.p.10" }, { player_id: "10" }, { name: { full: "Add Guy" } }],
                    { transaction_data: [{ type: "add" }, { destination_team_key: "470.l.344338.t.9" }] },
                  ],
                },
                1: {
                  player: [
                    [{ player_key: "470.p.11" }, { player_id: "11" }, { name: { full: "Drop Guy" } }],
                    { transaction_data: [{ type: "drop" }, { source_team_key: "470.l.344338.t.9" }] },
                  ],
                },
              },
            },
          ],
        },
      },
    };
    const txns = parseTransactions(raw);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe("add/drop");
    expect(txns[0].teamId).toBe("9");
    expect(txns[0].playersAdded.map((p) => p.name)).toEqual(["Add Guy"]);
    expect(txns[0].playersDropped.map((p) => p.name)).toEqual(["Drop Guy"]);
    expect(txns[0].faabAmount).toBe(5);
  });

  it("derives standings from completed matchups when Yahoo standings are empty", () => {
    const teams = parseTeams({
      teams: {
        0: { team: [{ team_key: "470.l.344338.t.1" }, { team_id: "1" }, { name: "A" }] },
        1: { team: [{ team_key: "470.l.344338.t.2" }, { team_id: "2" }, { name: "B" }] },
      },
    });
    const matchups = [
      matchup(1, side("1", 120), side("2", 90), "1"),
      matchup(2, side("1", 80), side("2", 110), "2"),
    ];
    const standings = deriveStandings(teams, [], matchups);
    expect(standings[0].wins + standings[1].wins).toBe(2);
    const a = standings.find((s) => s.teamId === "1")!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.pointsFor).toBe(200);
    expect(a.pointsAgainst).toBe(200);
  });
});

describe("superlatives", () => {
  const qb = (id: string, name: string, slot: string, points: number, actual = "QB"): PlayerScore => ({
    playerId: id, name, slot, actualPosition: actual, points, isStarter: slot !== "BN",
  });

  it("awards team of the week, dumpster fire, pain, statement, ice cold", () => {
    const matchups = [
      matchup(1, side("1", 160), side("2", 155), "1"),
      matchup(1, side("3", 70), side("4", 90), "4"),
    ];
    const awards = makeSuperlatives(matchups, 2026);
    const byTitle = Object.fromEntries(awards.map((a) => [a.title, a]));
    expect(byTitle["Team of the Week"].teamId).toBe("1");
    expect(byTitle["Dumpster Fire of the Week"].teamId).toBe("3");
    expect(byTitle["Pain of the Week"].teamId).toBe("2");
    expect(byTitle["Statement Win"].teamId).toBe("4");
    expect(byTitle["Ice Cold"].teamId).toBe("4");
    expect(byTitle["Brick Wall"]).toBeUndefined();
  });

  it("does not award zero-delta explosion/trending or 0-0 weeks", () => {
    const zeros = [matchup(1, side("1", 0), side("2", 0), "1")];
    expect(makeSuperlatives(zeros, 2026)).toEqual([]);
  });

  it("awards Donkey of the Week only when a bench swap would flip a loss", () => {
    const loserPlayers = [
      qb("1", "Start QB", "QB", 10),
      qb("2", "Start RB", "RB", 5, "RB"),
      qb("3", "Bench RB", "BN", 25, "RB"),
    ];
    const winnerPlayers = [qb("9", "Opp", "QB", 20)];
    const matchups = [
      matchup(1, side("1", 80, loserPlayers), side("2", 90, winnerPlayers), "2"),
    ];
    const donkey = findDonkey(matchups, 1, 2026);
    expect(donkey).not.toBeNull();
    expect(donkey!.teamId).toBe("1");
    expect(donkey!.value).toContain("Bench RB");
  });

  it("does not award Donkey when the bench player would not have won the matchup", () => {
    const loserPlayers = [
      qb("1", "Start RB", "RB", 10, "RB"),
      qb("2", "Bench RB", "BN", 12, "RB"),
    ];
    const matchups = [matchup(1, side("1", 80, loserPlayers), side("2", 100), "2")];
    expect(findDonkey(matchups, 1, 2026)).toBeNull();
  });
});
