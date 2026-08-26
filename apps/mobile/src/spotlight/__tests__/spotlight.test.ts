import { describe, expect, it } from "@jest/globals";

import {
  dailySpotlight,
  localDayWindow,
  SPOTLIGHT_VERSION,
} from "../spotlight";

const IDS = ["memory", "speed-tap-rush", "logic-code-cracker", "math-fast-math"];

describe("dailySpotlight", () => {
  it("is versioned", () => {
    expect(SPOTLIGHT_VERSION).toBe(1);
  });

  it("is deterministic per date and varies across dates", () => {
    const a1 = dailySpotlight(IDS, "2026-08-26");
    const a2 = dailySpotlight(IDS, "2026-08-26");
    expect(a2).toEqual(a1);
    const variety = new Set(
      Array.from({ length: 14 }, (_, i) => {
        const day = `2026-09-${String(i + 1).padStart(2, "0")}`;
        return dailySpotlight(IDS, day)?.gameId;
      }),
    );
    expect(variety.size).toBeGreaterThan(1);
  });

  it("always selects from the catalog and rotates every difficulty level", () => {
    for (let i = 1; i <= 28; i += 1) {
      const day = `2026-07-${String(i).padStart(2, "0")}`;
      const spot = dailySpotlight(IDS, day);
      expect(spot).not.toBeNull();
      expect(IDS).toContain(spot!.gameId);
    }
    const difficulties = new Set(
      Array.from({ length: 8 }, (_, i) => {
        const day = `2027-01-${String(i + 1).padStart(2, "0")}`;
        return dailySpotlight(IDS, day)!.difficulty;
      }),
    );
    expect(difficulties.size).toBe(4);
  });

  it("handles empty catalogs and day-boundary edges", () => {
    expect(dailySpotlight([], "2026-08-26")).toBeNull();
    // Leap-day and month-end must not throw or go out of rotation.
    expect(dailySpotlight(IDS, "2028-02-29")).not.toBeNull();
    expect(dailySpotlight(IDS, "2026-12-31")).not.toBeNull();
  });

  it("builds an inclusive local-day window", () => {
    const w = localDayWindow("2026-08-26");
    expect(w.toMs - w.fromMs).toBe(86_399_999);
    expect(w.fromMs).toBe(Date.parse("2026-08-26T00:00:00"));
  });
});
