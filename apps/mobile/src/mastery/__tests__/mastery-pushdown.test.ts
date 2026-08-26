import { describe, expect, it } from "@jest/globals";

import { createMigratedDb } from "../../db/__tests__/helpers";
import { SessionRepository } from "../../db/sessions";
import { computeMastery } from "../engine";

const T0 = 1_700_000_000_000;

/** Insert a session row directly (bypasses the completion pipeline). */
async function insertSession(
  sessions: SessionRepository,
  overrides: Partial<{
    id: string;
    gameId: string;
    level: string;
    normalizedResult: number;
    completedAt: number;
  }> = {},
): Promise<void> {
  const {
    id = `s-${Math.random().toString(36).slice(2)}`,
    gameId = "game-a",
    level = "normal",
    normalizedResult = 0.7,
    completedAt = T0,
  } = overrides;
  await sessions.completeSession({
    session: {
      id,
      gameId,
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 1,
      // Object form ({level}) exercises the same extraction path as the
      // Progress projection; bare strings resolve through the same expression.
      difficulty: { level },
      rawResult: {},
      normalizedResult,
      xp: 10,
      startedAt: completedAt - 1000,
      completedAt,
      durationMs: 1000,
    },
  });
}

describe("getMasteryInputs pushdown", () => {
  it("computes strong-clear counts and aggregates per game in one read", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);

    await insertSession(sessions, { id: "a1", gameId: "game-a", level: "hard", normalizedResult: 0.8 });
    await insertSession(sessions, { id: "a2", gameId: "game-a", level: "hard", normalizedResult: 0.65 });
    await insertSession(sessions, { id: "a3", gameId: "game-a", level: "hard", normalizedResult: 0.5 }); // below floor
    await insertSession(sessions, { id: "a4", gameId: "game-a", level: "expert", normalizedResult: 0.9 });
    // Volume gate: mastery tiers require ≥5 sessions before strength counts.
    await insertSession(sessions, { id: "a5", gameId: "game-a", level: "normal", normalizedResult: 0.6 });
    await insertSession(sessions, { id: "b1", gameId: "game-b", level: "easy", normalizedResult: 0.4 });

    const inputs = await sessions.getMasteryInputs();
    const byGame = new Map(inputs.map((i) => [i.gameId, i]));

    const a = byGame.get("game-a");
    expect(a).toBeDefined();
    expect(a!.sessions).toBe(5);
    expect(a!.bestNormalized).toBeCloseTo(0.9, 6);
    expect(a!.hardStrong).toBe(2); // 0.8 + 0.65 clear the 0.6 floor; 0.5 does not
    expect(a!.expertStrong).toBe(1);
    expect(a!.lastCompletedAt).toBeGreaterThan(0);

    const b = byGame.get("game-b");
    expect(b!.sessions).toBe(1);
    expect(b!.hardStrong).toBe(0);

    // Engine composition over the pushdown output.
    expect(computeMastery(a!).tier).toBe("advanced"); // 1 expert strong + 2 hard strong
  });

  it("returns no rows for an empty history (call sites map to unplayed)", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);
    expect(await sessions.getMasteryInputs()).toEqual([]);
  });

  it("recognizes bare-string difficulty levels too", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);
    await insertSession(sessions, {
      id: "bare",
      gameId: "game-c",
      level: "expert",
      normalizedResult: 0.7,
    });
    // Overwrite the JSON with a bare string to hit the second extraction arm.
    await adapter.run(
      "UPDATE game_sessions SET difficulty_json = ? WHERE id = 'bare'",
      ['"expert"'],
    );
    const inputs = await sessions.getMasteryInputs();
    expect(inputs[0]?.expertStrong).toBe(1);
  });
});
