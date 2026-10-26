import { describe, expect, it } from "vitest";
import { validateNewsletterFacts } from "./validation.js";

function contextFor(player: {
  name: string;
  nflTeamAbbreviation?: string | null;
  nflOpponentAbbreviation?: string | null;
  isRookieForSeason?: boolean;
}) {
  return {
    season: 2026,
    previousWeek: {
      matchups: [
        {
          home: {
            players: [
              {
                name: player.name,
                nflTeamAbbreviation: player.nflTeamAbbreviation ?? null,
                nflOpponentAbbreviation: player.nflOpponentAbbreviation ?? null,
                isRookieForSeason: player.isRookieForSeason === true,
              },
            ],
          },
        },
      ],
    },
  };
}

describe("validateNewsletterFacts", () => {
  it("catches a player's own NFL team being described as the opponent", () => {
    const issues = validateNewsletterFacts(
      "Sydaddy left Trevor Lawrence on the bench to score 36.34 points against Jax.",
      contextFor({ name: "Trevor Lawrence", nflTeamAbbreviation: "Jax" }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("Trevor Lawrence");
    expect(issues[0]).toContain("not their opponent");
  });

  it("recognizes the full name and nickname of the player's own NFL team", () => {
    const issues = validateNewsletterFacts(
      "Trevor Lawrence erupted for 36.34 against the Jacksonville Jaguars.",
      contextFor({ name: "Trevor Lawrence", nflTeamAbbreviation: "Jax" }),
    );
    expect(issues.some((issue) => issue.includes("not their opponent"))).toBe(true);
  });

  it("does not flag a different team as the opponent", () => {
    const issues = validateNewsletterFacts(
      "Trevor Lawrence erupted for 36.34 against the Rams.",
      contextFor({ name: "Trevor Lawrence", nflTeamAbbreviation: "Jax" }),
    );
    expect(issues).toHaveLength(0);
  });

  it("rejects stale or unsupported current-season rookie labels", () => {
    const issues = validateNewsletterFacts(
      "Rookie running back Cam Skattebo was held scoreless.",
      contextFor({ name: "Cam Skattebo", nflTeamAbbreviation: "NYG", isRookieForSeason: false }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("not explicitly confirm");
  });

  it("allows a rookie label only when current-season data explicitly confirms it", () => {
    const issues = validateNewsletterFacts(
      "Rookie running back Cam Skattebo was held scoreless.",
      contextFor({ name: "Cam Skattebo", nflTeamAbbreviation: "NYG", isRookieForSeason: true }),
    );
    expect(issues).toHaveLength(0);
  });

  it("does not confuse a generic rookie mistake with a player's rookie status", () => {
    const issues = validateNewsletterFacts(
      "A rookie mistake left Trevor Lawrence's 36.34 points on the bench.",
      contextFor({ name: "Trevor Lawrence", nflTeamAbbreviation: "Jax" }),
    );
    expect(issues).toHaveLength(0);
  });
});
