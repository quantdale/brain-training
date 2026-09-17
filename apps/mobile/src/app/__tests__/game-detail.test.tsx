/**
 * Campaign 032 Game Detail contract.
 *
 * These tests deliberately render the real Game Detail route through
 * expo-router's in-memory router and provide only the existing database
 * facade seam. The identity assertions are the integration contract for the
 * Campaign 032 identity implementation:
 * `game-detail-identity`, `game-detail-identity-verb`, and
 * `game-detail-mechanic`.
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderRouter, screen } from "expo-router/testing-library";

import GameDetailScreen from "@/app/game-detail/[id]";
import type {
  AppDatabase,
  GameAggregate,
  GameSessionRecord,
} from "@/db";
import { type MasteryInput } from "@/mastery";
import { registerGameDefinitions } from "@/registry/registry";
import { registry } from "@/registry/registry.generated";
import type { GameDefinition } from "@/sdk";

const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock("@/db", () => {
  const actual = jest.requireActual("@/db") as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

const MEMORY_GAME = registry.find(
  (game) => game.id === "memory-grid-recall",
) as GameDefinition;

const NOW = 1_700_000_000_000;

function makeMasteryInput(overrides: Partial<MasteryInput> = {}): MasteryInput {
  return {
    gameId: MEMORY_GAME.id,
    sessions: 0,
    bestNormalized: 0,
    avgNormalized: 0,
    hardStrong: 0,
    expertStrong: 0,
    lastCompletedAt: 0,
    ...overrides,
  };
}

function makeSession(overrides: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id: "session-1",
    gameId: MEMORY_GAME.id,
    gameVersion: 1_000_000,
    generatorVersion: 1_000_000,
    scoringVersion: 1_000_000,
    seed: 42,
    difficulty: { level: "normal" },
    rawResult: {},
    normalizedResult: 0.84,
    xp: 48,
    startedAt: NOW - 90_000,
    completedAt: NOW - 30_000,
    durationMs: 60_000,
    ...overrides,
  };
}

function makeFakeDb(overrides: {
  favorite?: boolean;
  aggregate?: GameAggregate | null;
  recent?: GameSessionRecord[];
  masteryInput?: MasteryInput | null;
} = {}): AppDatabase {
  const aggregate = overrides.aggregate ?? null;
  const recent = overrides.recent ?? [];
  const masteryInput = overrides.masteryInput ?? makeMasteryInput();

  return {
    sessions: {
      getGameAggregate: async () => aggregate,
      listByGame: async () => recent,
      getMasteryInputByGame: async () => masteryInput,
    },
    favorites: {
      isFavorite: async () => overrides.favorite ?? false,
      setFavorite: async () => undefined,
      removeFavorite: async () => undefined,
    },
  } as unknown as AppDatabase;
}

async function renderDetail(id: string) {
  const result = renderRouter(
    { "game-detail/[id]": GameDetailScreen },
    { initialUrl: `/game-detail/${id}` },
  );
  await result;
  // renderRouter installs fake timers internally; switch back before using
  // async Testing Library queries, matching the neighboring route tests.
  jest.useRealTimers();
  await act(async () => {});
  return result;
}

function collectTestIds(node: unknown, ids: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectTestIds(child, ids);
    return ids;
  }
  if (node === null || typeof node !== "object") return ids;

  const candidate = node as {
    props?: { testID?: unknown };
    children?: unknown;
  };
  if (typeof candidate.props?.testID === "string") {
    ids.push(candidate.props.testID);
  }
  collectTestIds(candidate.children, ids);
  return ids;
}

function expectBefore(ids: string[], before: string, after: string): void {
  const beforeIndex = ids.indexOf(before);
  const afterIndex = ids.indexOf(after);
  expect(beforeIndex).toBeGreaterThanOrEqual(0);
  expect(afterIndex).toBeGreaterThanOrEqual(0);
  expect(beforeIndex).toBeLessThan(afterIndex);
}

describe("Game Detail — Campaign 032 identity-first contract", () => {
  beforeEach(() => {
    registerGameDefinitions([MEMORY_GAME]);
    mockDbState.db = null;
  });

  it("puts identity, mechanic, mastery context, and Play before history", async () => {
    mockDbState.db = makeFakeDb({
      masteryInput: makeMasteryInput({ sessions: 2, bestNormalized: 0.78 }),
    });

    await renderDetail(MEMORY_GAME.id);

    expect(screen.getByTestId("game-detail-identity")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-identity-verb")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-mechanic")).toHaveTextContent(
      /pattern|memory|recall|cell/i,
    );
    expect(screen.getByTestId("game-detail-title")).toHaveTextContent(
      MEMORY_GAME.name,
    );
    expect(screen.getByTestId("game-detail-mastery-ring")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-play")).toHaveTextContent(
      `Play ${MEMORY_GAME.name}`,
    );
    expect(screen.getByTestId("game-detail-records")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-recent")).toBeOnTheScreen();

    const ids = collectTestIds(screen.toJSON());
    expectBefore(ids, "game-detail-identity", "game-detail-play");
    expectBefore(ids, "game-detail-mechanic", "game-detail-play");
    expectBefore(ids, "game-detail-play", "game-detail-records");
    expectBefore(ids, "game-detail-play", "game-detail-recent");
  }, 30_000);

  it("keeps favorite, mastery, aggregate, and recent-session evidence intact", async () => {
    const session = makeSession();
    mockDbState.db = makeFakeDb({
      favorite: true,
      aggregate: {
        gameId: MEMORY_GAME.id,
        count: 3,
        avgNormalized: 0.72,
        bestNormalized: 0.84,
        lastCompletedAt: session.completedAt,
      },
      recent: [session],
      masteryInput: makeMasteryInput({
        sessions: 3,
        bestNormalized: 0.84,
        avgNormalized: 0.72,
        lastCompletedAt: session.completedAt,
      }),
    });

    await renderDetail(MEMORY_GAME.id);

    expect(screen.getByTestId("game-detail-favorite")).toHaveTextContent(/Favorited/);
    expect(screen.getByTestId("game-detail-mastery-ring")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-stat-sessions")).toHaveTextContent(/3/);
    expect(screen.getByTestId("game-detail-stat-best")).toHaveTextContent(/84%/);
    expect(screen.getByTestId("game-detail-session-session-1")).toHaveTextContent(/84%/);

    const ids = collectTestIds(screen.toJSON());
    expectBefore(ids, "game-detail-play", "game-detail-records");
    expectBefore(ids, "game-detail-play", "game-detail-recent");
  }, 30_000);

  it("keeps unknown-game fallback safe and free of a Play action", async () => {
    registerGameDefinitions([]);
    mockDbState.db = makeFakeDb();

    await renderDetail("does-not-exist");

    expect(screen.getByTestId("game-detail-unknown")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-unknown-browse")).toBeOnTheScreen();
    expect(screen.getByTestId("game-detail-back")).toBeOnTheScreen();
    expect(screen.queryByTestId("game-detail-play")).toBeNull();
    expect(screen.queryByTestId("game-detail-records")).toBeNull();
    expect(screen.queryByTestId("game-detail-identity")).toBeNull();
  }, 30_000);
});
