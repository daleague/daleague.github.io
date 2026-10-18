import { describe, expect, it } from "vitest";
import { hasKnownLineupUnavailability } from "./lineup";

describe("hasKnownLineupUnavailability", () => {
  it("excludes players on a bye", () => {
    expect(hasKnownLineupUnavailability({ gameStatus: "bye" })).toBe(true);
  });

  it.each(["Q", "Questionable", "Doubtful", "Out", "IR", "PUP", "Inactive", "Suspended"])(
    "excludes players with unavailable status %s",
    (availabilityStatus) => {
      expect(hasKnownLineupUnavailability({ availabilityStatus })).toBe(true);
    },
  );

  it("excludes players with an injury note", () => {
    expect(hasKnownLineupUnavailability({ injuryNote: "Ankle" })).toBe(true);
  });

  it.each(["IR", "IR+", "NA"])("excludes unavailable roster slots %s", (slot) => {
    expect(hasKnownLineupUnavailability({ slot })).toBe(true);
  });

  it("does not exclude active players or players with unknown status", () => {
    expect(hasKnownLineupUnavailability({ availabilityStatus: "Active", gameStatus: "in_progress" })).toBe(false);
    expect(hasKnownLineupUnavailability({})).toBe(false);
  });

  it("does not treat an empty or healthy note as an injury", () => {
    expect(hasKnownLineupUnavailability({ injuryNote: "No injury" })).toBe(false);
    expect(hasKnownLineupUnavailability({ injuryNote: " " })).toBe(false);
  });
});
