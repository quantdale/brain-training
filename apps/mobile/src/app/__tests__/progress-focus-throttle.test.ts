/**
 * 061: Progress focus-throttle decision — snapshot reloads at most every 5s
 * (sessions take minutes; a bounce inside the window cannot hide real data),
 * while `nowMs` label freshness stays per-focus (handled by the caller).
 */
import { describe, expect, it } from "@jest/globals";

import { shouldScheduleFocusReload } from "@/app/(tabs)/progress";

describe("shouldScheduleFocusReload (061)", () => {
  it("loads on first focus and after the window settles", () => {
    // Production clocks are epoch-ms: lastLoad 0 means never loaded.
    expect(shouldScheduleFocusReload(0, 1_700_000_000_000)).toBe(true);
    expect(shouldScheduleFocusReload(1_000, 36_000)).toBe(true);
  });

  it("skips reloads bouncing inside the window", () => {
    expect(shouldScheduleFocusReload(1_000, 3_000)).toBe(false);
    expect(shouldScheduleFocusReload(1_000, 6_000)).toBe(false);
    expect(shouldScheduleFocusReload(1_000, 6_001)).toBe(true);
  });
});
