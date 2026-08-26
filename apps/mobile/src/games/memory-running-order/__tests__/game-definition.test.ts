// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import { SDK_VERSION } from "@/sdk";

import { gameDefinition } from "../game-definition";
import gameJson from "../game.json";
import { GAME_ID } from "../types";

describe("game.json", () => {
  it("satisfies the registry generator contract and pins version bumps", () => {
    // The registry generator (scripts/generate-game-registry.mjs) requires the
    // id to equal the directory name and every field to pass defineGame.
    expect(gameJson.id).toBe(GAME_ID);
    expect(gameDefinition.id).toBe(GAME_ID);
    expect(gameDefinition.sdkVersion).toBe(SDK_VERSION);
    // generatorVersion 1.1.0: campaign-014 memory-depth wave — the symbol
    // palette widened to 12 and the near-duplicate guard strengthened to
    // Hamming >= 2, so same-seed draws changed.
    expect(gameDefinition.gameVersion).toBe("1.0.0");
    expect(gameDefinition.generatorVersion).toBe("1.1.0");
    expect(gameDefinition.hasTutorial).toBe(true);
    expect(gameDefinition.description).toBeTruthy();
  });
});
