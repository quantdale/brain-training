/**
 * Selection behavior — category-diverse picking, `exclude` (reroll after partial
 * completion), and catalog-scale robustness (Queue B / Queue A / Queue E).
 */
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";
import type { GameDefinition } from "@/sdk";
import { pickDiverse, pickWorkoutGames, WORKOUT_SIZE } from "../today";

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
    // Falls back to all games rather than producing a too-small workout.
    expect(picked.length).toBe(WORKOUT_SIZE + 1);
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
