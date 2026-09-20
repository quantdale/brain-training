/**
 * `reconcileWorkout` — repair a persisted instance against the current eligible
 * catalog (Queue A: catalog changes invalidating stored workouts, crashes if
 * registry changes, invalid game IDs, cross-day recovery).
 */
import { describe, expect, it } from "@jest/globals";
import type { WorkoutInstance } from "@/db";
import { reconcileWorkout } from "../reconcile";

function makeInstance(
  overrides: Partial<WorkoutInstance> = {},
): WorkoutInstance {
  return {
    date: "2026-08-20",
    gameIds: ["a", "b", "c", "d"],
    status: "active",
    currentIndex: 0,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("reconcileWorkout", () => {
  it("returns the instance unchanged when every game is still eligible", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "d"]);
    expect(changed).toBe(false);
    expect(instance).toBe(inst);
  });

  it("falls back to honest truncation when the pool has no spare (degenerate)", () => {
    // 056: b retired at the current position with NO eligible substitute —
    // the repair truncates instead of inventing a game. Same visible shape
    // as the old truncation, now an explicit fallback rather than the rule.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "c", "d"]); // b retired, no spare
    expect(changed).toBe(true);
    expect(instance?.gameIds).toEqual(["a", "c", "d"]);
    // Current game (b at index 1) was dropped; index advances to the next valid slot.
    expect(instance?.currentIndex).toBe(1);
    expect(instance?.gameIds[instance.currentIndex]).toBe("c");
    expect(instance?.status).toBe("active");
  });

  it("advances the resume point past a retired CURRENT game (no-spare fallback)", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const { instance } = reconcileWorkout(inst, ["a", "c", "d"]); // b (current) retired, no spare
    // b was the current game; after dropping b the resume point lands on c.
    expect(instance?.currentIndex).toBe(1);
    expect(instance?.gameIds[instance.currentIndex ?? -1]).toBe("c");
  });

  it("056: substitutes multiple retired legs in pool order without overfilling", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    // b and c retired (current + future); spares e, f, g — only two slots
    // need filling. The surviving future leg keeps its slot, then pool order
    // decides: e then f, never g (no overfill).
    const { instance, changed } = reconcileWorkout(inst, ["a", "d", "e", "f", "g"]);
    expect(changed).toBe(true);
    expect(instance?.gameIds).toEqual(["a", "d", "e", "f"]);
    expect(instance?.gameIds).toHaveLength(4);
    expect(instance?.currentIndex).toBe(1);
    expect(instance?.status).toBe("active");
  });

  it("056: never substitutes into or rewrites a completed record", () => {
    // Corrupt shape: completed but resume mid-list with a retired future.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 2,
      status: "completed",
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "e"]);
    expect(instance?.status).toBe("completed");
    expect(instance?.gameIds).toEqual(["a", "b", "c", "d"]);
    expect(instance?.currentIndex).toBe(2);
    expect(changed).toBe(false);
  });

  it("keeps a retired PLAYED game verbatim and never rewrites history", () => {
    // 056 substitute-and-preserve: a was already played (leg 0 done, resume
    // at leg 2), so its later retirement must not rewrite the played prefix.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 2,
    });
    const { instance, changed } = reconcileWorkout(inst, ["b", "c", "d"]); // a retired (played)
    expect(changed).toBe(false);
    expect(instance).toBe(inst);
    expect(instance?.gameIds).toEqual(["a", "b", "c", "d"]);
    expect(instance?.currentIndex).toBe(2);
    expect(instance?.gameIds[instance.currentIndex]).toBe("c");
  });

  it("substitutes a retired FUTURE leg and preserves length without completing", () => {
    // 056: the word-match-shaped case — last unplayed leg retired while a
    // substitute exists. No credit is granted; the user must play the sub.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 3,
      status: "active",
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "e"]);
    expect(changed).toBe(true);
    expect(instance?.gameIds).toEqual(["a", "b", "c", "e"]);
    expect(instance?.currentIndex).toBe(3);
    expect(instance?.status).toBe("active");
  });

  it("never invents a pool-order workout for a fully-stale instance (regenerate instead)", () => {
    // Nothing played, nothing survives: even though x/y could fill slots,
    // the caller must run the real seeded selection.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 0,
    });
    const { instance, changed } = reconcileWorkout(inst, ["x", "y"]);
    expect(instance).toBeNull();
    expect(changed).toBe(true);
  });

  it("never resurrects a completed instance, even when its games retired", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 4,
      status: "completed",
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b"]);
    expect(instance?.status).toBe("completed");
    // Played history is preserved verbatim, not truncated.
    expect(instance?.gameIds).toEqual(["a", "b", "c", "d"]);
    expect(instance?.currentIndex).toBe(4);
    expect(changed).toBe(false);
  });

  it("substitution is deterministic: re-running converges without churning", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 3,
    });
    const first = reconcileWorkout(inst, ["a", "b", "c", "e"]);
    const second = reconcileWorkout(first.instance, ["a", "b", "c", "e"]);
    expect(second.changed).toBe(false);
    expect(second.instance).toBe(first.instance);
    expect(first.instance?.gameIds).toEqual(["a", "b", "c", "e"]);
  });

  it("returns null when every stored game is ineligible (caller regenerates)", () => {
    const inst = makeInstance({ gameIds: ["a", "b", "c", "d"] });
    const { instance, changed } = reconcileWorkout(inst, ["x", "y"]);
    expect(instance).toBeNull();
    expect(changed).toBe(true);
  });

  it("marks the workout completed when removal pushes the index past the end", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 3,
      status: "active",
    });
    const { instance } = reconcileWorkout(inst, ["a", "b", "c"]); // d (current, last) retired
    expect(instance?.gameIds).toEqual(["a", "b", "c"]);
    expect(instance?.currentIndex).toBe(3);
    expect(instance?.status).toBe("completed");
  });

  it("is idempotent: reconciling an already-repaired instance changes nothing", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const first = reconcileWorkout(inst, ["a", "c", "d"]);
    const second = reconcileWorkout(first.instance, ["a", "c", "d"]);
    expect(second.changed).toBe(false);
    expect(second.instance).toBe(first.instance);
  });

  it("does not mutate the input instance", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const snapshot = JSON.parse(JSON.stringify(inst));
    reconcileWorkout(inst, ["a", "c", "d"]);
    expect(inst).toEqual(snapshot);
  });

  it("accepts an eligible-id Set as well as an array", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1,
    });
    const asSet = reconcileWorkout(inst, new Set(["a", "c", "d"]));
    const asArr = reconcileWorkout(inst, ["a", "c", "d"]);
    expect(asSet.instance?.gameIds).toEqual(asArr.instance?.gameIds);
  });

  it("repairs a corrupted NEGATIVE currentIndex to the first valid game (no crash)", () => {
    // A drifted row must not hit Array.slice's negative-from-the-end semantics:
    // resume lands on the first valid game instead of skipping ahead.
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: -2,
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "d"]);
    expect(changed).toBe(true);
    expect(instance?.currentIndex).toBe(0);
    expect(instance?.gameIds[instance.currentIndex]).toBe("a");
    expect(instance?.status).toBe("active");
  });

  it("repairs a negative currentIndex whose clamped game was retired", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: -5,
    });
    const { instance } = reconcileWorkout(inst, ["b", "c", "d"]); // a retired
    expect(instance?.gameIds).toEqual(["b", "c", "d"]);
    expect(instance?.currentIndex).toBe(0);
    expect(instance?.gameIds[instance.currentIndex]).toBe("b");
  });

  it("treats an out-of-range currentIndex as exhausted and completes the workout", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 9,
    });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "d"]);
    expect(changed).toBe(true);
    expect(instance?.currentIndex).toBe(4);
    expect(instance?.status).toBe("completed");
  });

  it("truncates a non-integer currentIndex back onto a real position", () => {
    const inst = makeInstance({
      gameIds: ["a", "b", "c", "d"],
      currentIndex: 1.5,
    });
    const { instance } = reconcileWorkout(inst, ["a", "b", "c", "d"]);
    expect(instance?.currentIndex).toBe(1);
    expect(instance?.gameIds[instance.currentIndex]).toBe("b");
  });

  it("repairs a non-finite currentIndex instead of propagating NaN", () => {
    const inst = makeInstance({ currentIndex: Number.NaN });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b", "c", "d"]);
    expect(changed).toBe(true);
    expect(instance?.currentIndex).toBe(0);
    expect(instance?.status).toBe("active");
  });

  it("handles an empty stored game list by signalling regeneration", () => {
    const inst = makeInstance({ gameIds: [] });
    const { instance, changed } = reconcileWorkout(inst, ["a", "b"]);
    expect(instance).toBeNull();
    expect(changed).toBe(true);
  });
});
