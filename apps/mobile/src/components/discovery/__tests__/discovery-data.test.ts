/**
 * 061: discovery snapshot stabilization — identical reloads reuse per-game
 * mastery objects (restoring tile memo bailouts); changed games yield fresh
 * objects. Never mutates either snapshot.
 */
import { describe, expect, it } from "@jest/globals";

import {
  stabilizeDiscoverySnapshot,
  type DiscoverySnapshot,
} from "@/components/discovery/discovery-data";
import type { MasterySummary } from "@/mastery";

function evidence(over = {}): MasterySummary["evidence"] {
  return {
    gameId: "g",
    sessions: 0,
    bestNormalized: 0,
    avgNormalized: 0,
    hardStrong: 0,
    expertStrong: 0,
    lastCompletedAt: 0,
    ...over,
  };
}

function summary(over: Partial<MasterySummary> = {}): MasterySummary {
  return {
    gameId: "g",
    tier: "unplayed",
    rank: 0,
    nextMilestone: null,
    evidence: evidence(),
    ...over,
  };
}

function snapshot(ids: readonly string[], tweak?: { id: string; patch: Partial<MasterySummary> }): DiscoverySnapshot {
  const masteryByGame = new Map<string, MasterySummary>();
  for (const id of ids) {
    masteryByGame.set(
      id,
      summary(tweak && tweak.id === id ? tweak.patch : undefined),
    );
  }
  return {
    favorites: new Set<string>(["memory"]),
    masteryByGame,
  } as DiscoverySnapshot;
}

describe("stabilizeDiscoverySnapshot (061)", () => {
  it("returns the next snapshot untouched on first load", () => {
    const next = snapshot(["a", "b"]);
    expect(stabilizeDiscoverySnapshot(null, next)).toBe(next);
  });

  it("reuses identical per-game objects and the favorites set", () => {
    const prev = snapshot(["a", "b"]);
    const next = snapshot(["a", "b"]);
    const stable = stabilizeDiscoverySnapshot(prev, next);
    expect(stable.masteryByGame.get("a")).toBe(prev.masteryByGame.get("a"));
    expect(stable.masteryByGame.get("b")).toBe(prev.masteryByGame.get("b"));
    expect(stable.favorites).toBe(prev.favorites);
    // Inputs untouched.
    expect(next.masteryByGame.get("a")).not.toBe(prev.masteryByGame.get("a"));
  });

  it("yields a fresh object for the changed game only", () => {
    const prev = snapshot(["a", "b"]);
    const next = snapshot(["a", "b"], {
      id: "b",
      patch: { evidence: evidence({ sessions: 3 }) },
    });
    const stable = stabilizeDiscoverySnapshot(prev, next);
    expect(stable.masteryByGame.get("a")).toBe(prev.masteryByGame.get("a"));
    expect(stable.masteryByGame.get("b")).toBe(next.masteryByGame.get("b"));
    expect(stable.masteryByGame.get("b")).not.toBe(prev.masteryByGame.get("b"));
  });

  it("adopts a changed favorites set", () => {
    const prev = snapshot(["a"]);
    const next = snapshot(["a"]);
    next.favorites = new Set<string>(["memory", "speed-tap-rush"]);
    const stable = stabilizeDiscoverySnapshot(prev, next);
    expect(stable.favorites).toBe(next.favorites);
  });
});
