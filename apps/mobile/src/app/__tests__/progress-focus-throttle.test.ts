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

/**
 * 072: the focus throttle must be INPUT-AWARE, not a pure time window.
 *
 * The pure-time version defended itself with "sessions take minutes, so a
 * bounce inside this window cannot hide real data". That covers a session
 * completed in the past and NOT one completed in this app seconds ago: finish a
 * workout, return to Progress inside the window, and the reload is skipped, so
 * the screen shows a pre-workout state stamped with a current time — which reads
 * as fresh. These cases pin the fingerprint override.
 */
describe("shouldScheduleFocusReload is input-aware (072)", () => {
  const LAST_LOAD = 1_000;
  const NOW = 3_000; // well inside the 5s window

  it("still skips a bounce when the input has NOT changed", () => {
    expect(shouldScheduleFocusReload(LAST_LOAD, NOW, "s1@100", "s1@100")).toBe(false);
  });

  it("reloads inside the window when a new session was completed", () => {
    // The regression: a completion hidden by the time window.
    expect(shouldScheduleFocusReload(LAST_LOAD, NOW, "s2@200", "s1@100")).toBe(true);
  });

  it("treats a disappeared fingerprint as a change, not as no-opinion", () => {
    // A backup replace can remove the newest session. Ignoring that would
    // leave the screen showing a session the user no longer has.
    expect(shouldScheduleFocusReload(LAST_LOAD, NOW, "", "s1@100")).toBe(true);
  });

  it("keeps the first-load and post-window behavior unchanged", () => {
    expect(shouldScheduleFocusReload(0, 1_700_000_000_000, "s1@1", null)).toBe(true);
    expect(shouldScheduleFocusReload(LAST_LOAD, 6_001, "s1@1", null)).toBe(true);
    expect(shouldScheduleFocusReload(LAST_LOAD, 3_000, "s1@1", null)).toBe(false);
  });
});
