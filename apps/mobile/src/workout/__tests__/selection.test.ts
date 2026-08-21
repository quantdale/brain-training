/**
 * Selection behavior — category-diverse picking, `exclude` (reroll after partial
 * completion), and catalog-scale robustness (Queue B / Queue A / Queue E).
 */
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";
import type { GameDefinition } from "@/sdk";
import { reconcileWorkout } from "../reconcile";
import {
  dailyWorkout,
  MAX_OVERLAP_WITH_YESTERDAY,
  pickDiverse,
  pickWorkoutGames,
  WORKOUT_SIZE,
} from "../today";

const CATEGORIES: GameDefinition["primaryCategory"][] = [
  "Memory",
  "Attention",
  "Speed",
  "Math",
  "Language",
  "Logic & Problem Solving",
  "Flexibility",
  "Spatial",
];

function makeGames(count: number): GameDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `game-${i}`,
    name: `Game ${i}`,
    primaryCategory: CATEGORIES[i % CATEGORIES.length],
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: null,
    contentVersion: null,
    hasTutorial: false,
  }));
}

function distinctCategories(games: readonly GameDefinition[]): string[] {
  return [...new Set(games.map((g) => g.primaryCategory))];
}

describe("pickDiverse", () => {
  it("returns the whole pool when smaller than the requested count", () => {
    const games = makeGames(3);
    expect(pickDiverse(games, 4, createRng("s")).length).toBe(3);
  });

  it("maximizes cognitive-domain coverage instead of collapsing on one category", () => {
    // 24 games, 3 per category — plenty of every category.
    const games = makeGames(24);
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const picked = pickDiverse(games, WORKOUT_SIZE, createRng(seed));
      expect(picked).toHaveLength(WORKOUT_SIZE);
      // Round-robin across categories should yield distinct categories for each pick.
      expect(distinctCategories(picked).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not mutate the input pool", () => {
    const games = makeGames(24);
    const before = games.map((g) => g.id);
    pickDiverse(games, WORKOUT_SIZE, createRng("immutable"));
    expect(games.map((g) => g.id)).toEqual(before);
  });
});

describe("pickWorkoutGames exclude (reroll after partial completion)", () => {
  it("never returns excluded (already-played) games when enough remain", () => {
    const games = makeGames(24);
    for (const date of ["2026-08-16", "2026-08-17", "2026-09-01"]) {
      const picked = pickWorkoutGames(games, date, [], 0, ["game-0", "game-1"]);
      expect(picked).toHaveLength(WORKOUT_SIZE);
      expect(picked.every((g) => g.id !== "game-0" && g.id !== "game-1")).toBe(
        true,
      );
    }
  });

  it("falls back to including excluded games only when excluding would leave too few", () => {
    // Catalog of exactly WORKOUT_SIZE+1 games, exclude WORKOUT_SIZE-1 of them so
    // the eligible remainder is smaller than the workout — robustness path.
    const games = makeGames(WORKOUT_SIZE + 1);
    const exclude = games.slice(0, WORKOUT_SIZE - 1).map((g) => g.id);
    const picked = pickWorkoutGames(games, "2026-08-16", [], 0, exclude);
    // The exclusion is relaxed (never a too-small workout), but the workout
    // stays exactly WORKOUT_SIZE: drawn from all games, so at least one
    // excluded id must appear.
    expect(picked).toHaveLength(WORKOUT_SIZE);
    expect(picked.some((g) => exclude.includes(g.id))).toBe(true);
  });
});

describe("catalog-scale robustness (Queue E)", () => {
  it("selects a valid 4-game workout from a 200-game catalog quickly", () => {
    const games = makeGames(200);
    const start = Date.now();
    const picked = pickWorkoutGames(games, "2026-08-16");
    const elapsed = Date.now() - start;
    expect(picked).toHaveLength(WORKOUT_SIZE);
    expect(new Set(picked.map((g) => g.id)).size).toBe(WORKOUT_SIZE);
    expect(distinctCategories(picked).length).toBeGreaterThanOrEqual(3);
    // O(catalog) per day-step, not O(history * catalog); well under a second.
    expect(elapsed).toBeLessThan(1000);
  });

  it("stays deterministic across many calls for the same inputs", () => {
    const games = makeGames(200);
    const a = pickWorkoutGames(games, "2026-08-16");
    const b = pickWorkoutGames(games, "2026-08-16");
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
  });
});

describe("catalog growth 36 → 40 (Queue E: no hardcoded ids/count assumptions)", () => {
  /** A week of dates starting 2026-08-10. */
  const WEEK = Array.from(
    { length: 7 },
    (_, i) => `2026-08-${String(10 + i).padStart(2, "0")}`,
  );

  it("keeps past selections stable and stored instances eligible across growth", () => {
    // Today's real-world catalog size, then the near-future size.
    const base36 = makeGames(36);
    const grown40 = [...base36, ...makeGames(40).slice(36)];

    // Selections are a pure function of (catalog, date): recomputing a past
    // day against the SAME 36-catalog is byte-identical before and after the
    // catalog grows elsewhere.
    const beforeGrowth = WEEK.map((d) =>
      dailyWorkout(base36, d).map((g) => g.id),
    );
    const afterGrowthRecomputed = WEEK.map((d) =>
      dailyWorkout(base36, d).map((g) => g.id),
    );
    expect(afterGrowthRecomputed).toEqual(beforeGrowth);

    // Persisted instances from the 36-era reconcile cleanly under the larger
    // catalog: nothing they reference was retired, so no repair is needed.
    for (const ids of beforeGrowth) {
      const inst = {
        date: "2026-08-10",
        gameIds: ids,
        status: "active" as const,
        currentIndex: 2,
        rerollAttempt: 0,
        seedVersion: 1,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const { instance, changed } = reconcileWorkout(
        inst,
        grown40.map((g) => g.id),
      );
      expect(changed).toBe(false);
      expect(instance?.gameIds).toEqual(ids);
      expect(instance?.currentIndex).toBe(2);
    }
  });

  it("selects valid, diverse, overlap-capped workouts from the grown catalog", () => {
    const grown40 = makeGames(40);
    let previous: string[] = [];
    for (const date of WEEK) {
      const workout = dailyWorkout(grown40, date);
      expect(workout).toHaveLength(WORKOUT_SIZE);
      expect(new Set(workout.map((g) => g.id)).size).toBe(WORKOUT_SIZE);
      expect(distinctCategories(workout).length).toBeGreaterThanOrEqual(3);
      if (previous.length > 0) {
        const overlap = workout.filter((g) => previous.includes(g.id)).length;
        expect(overlap).toBeLessThanOrEqual(MAX_OVERLAP_WITH_YESTERDAY);
      }
      previous = workout.map((g) => g.id);
    }
  });

  it("rerolls and exclusions keep working at the grown size", () => {
    const grown40 = makeGames(40);
    const exclude = ["game-0", "game-1", "game-19"];
    const picked = pickWorkoutGames(grown40, "2026-08-16", [], 3, exclude);
    expect(picked).toHaveLength(WORKOUT_SIZE);
    expect(picked.every((g) => !exclude.includes(g.id))).toBe(true);
    expect(new Set(picked.map((g) => g.id)).size).toBe(WORKOUT_SIZE);
  });
});

describe("selection invariants across catalog sizes (property sweep)", () => {
  const SIZES = [5, 8, 13, 21, 36, 40, 64];
  const DATES = [
    "2026-01-01",
    "2026-08-16",
    "2026-12-31",
    "2027-03-15",
  ];

  it("always returns min(WORKOUT_SIZE, size) DISTINCT games", () => {
    for (const size of SIZES) {
      const games = makeGames(size);
      for (const date of DATES) {
        const picked = pickWorkoutGames(games, date);
        expect(picked).toHaveLength(Math.min(WORKOUT_SIZE, size));
        expect(new Set(picked.map((g) => g.id)).size).toBe(picked.length);
      }
    }
  });

  it("keeps consecutive-day overlap within the provable bound for every size", () => {
    // The cap holds by construction whenever enough fresh games exist; tiny
    // catalogs mathematically force more repeats. The exact bound:
    // overlap ≤ WORKOUT_SIZE − min(freshCount, WORKOUT_SIZE − MAX_OVERLAP)
    // where freshCount = size − WORKOUT_SIZE (yesterday's games excluded).
    for (const size of SIZES) {
      const games = makeGames(size);
      const freshCount = size - WORKOUT_SIZE;
      const bound =
        WORKOUT_SIZE - Math.min(freshCount, WORKOUT_SIZE - MAX_OVERLAP_WITH_YESTERDAY);
      let previous: string[] = [];
      for (let day = 1; day <= 14; day += 1) {
        const date = `2026-06-${String(day).padStart(2, "0")}`;
        const workout = dailyWorkout(games, date);
        if (previous.length > 0) {
          const overlap = workout.filter((g) => previous.includes(g.id)).length;
          expect(overlap).toBeLessThanOrEqual(bound);
        }
        previous = workout.map((g) => g.id);
      }
    }
  });

  it("pins the realistic-catalog cap to exactly MAX_OVERLAP_WITH_YESTERDAY", () => {
    // From 7 games up there are always ≥3 fresh candidates, so the soft cap
    // must hold exactly — this is the regime every real catalog lives in.
    for (const size of [7, 8, 13, 21, 36, 40]) {
      const games = makeGames(size);
      let previous: string[] = [];
      for (let day = 1; day <= 20; day += 1) {
        const date = `2026-07-${String(day).padStart(2, "0")}`;
        const workout = dailyWorkout(games, date);
        if (previous.length > 0) {
          const overlap = workout.filter((g) => previous.includes(g.id)).length;
          expect(overlap).toBeLessThanOrEqual(MAX_OVERLAP_WITH_YESTERDAY);
        }
        previous = workout.map((g) => g.id);
      }
    }
  });
});
