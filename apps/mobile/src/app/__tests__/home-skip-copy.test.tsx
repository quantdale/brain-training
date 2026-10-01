/**
 * Change 073 §3/§4 — Home's plan copy and the honest leg launches.
 *
 * A skipped leg is its own outcome and must never render as "Done", and a tap
 * on a later leg must record an EXPLICIT jump (the unplayed prefix becomes
 * skipped) before the launch tuple is handed to the game — so the tuple is
 * true against the durable row instead of claiming a leg the row does not own.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import HomeScreen from '@/app/(tabs)/index';
import type { AppDatabase, WorkoutInstance } from '@/db';
import { registerGameDefinitions } from '@/registry/registry';
import { registry as generatedRegistry } from '@/registry/registry.generated';
import { resetProgressionFocusSyncForTests } from '@/progression/focus-sync';

const mockDbState: {
  db: AppDatabase | null;
  skipCalls: number[];
} = { db: null, skipCalls: [] };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

jest.mock('@/progression', () => {
  const actual = jest.requireActual('@/progression') as Record<string, unknown>;
  return {
    ...actual,
    refreshProgression: jest.fn(async () => ({
      sessions: [],
      lifetime: { sessionCount: 0, totalXp: 0 },
    })),
  };
});

const GAMES = generatedRegistry.slice(0, 4).map((g) => g.id);

function makeInstance(overrides: Partial<WorkoutInstance> = {}): WorkoutInstance {
  return {
    date: '2026-09-30',
    gameIds: GAMES,
    status: 'active',
    currentIndex: 1,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 0,
    updatedAt: 0,
    skippedIndices: [0],
    ...overrides,
  };
}

function makeFakeDb(instance: WorkoutInstance): AppDatabase {
  return {
    ratings: { getRatings: async () => [] },
    sessions: {
      listRecent: async () => [],
      getTotalXp: async () => 0,
      getDistinctActivityDates: async () => [],
      getAggregates: async () => [],
      listSummaries: async () => [],
      getMasteryInputs: async () => [],
      countSessions: async () => 0,
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    profile: { get: async () => ({ settings: {} }) },
    achievements: { listUnlocks: async () => [] },
    quests: { listProgressForQuest: async () => [] },
    workouts: {
      getOrCreate: async () => instance,
      getByDate: async () => instance,
      reconcile: async () => instance,
      reconcileActiveInstances: async () => [],
      listHistory: async () => [],
      listRecentSummaries: async () => [],
      skipToLeg: jest.fn(async (_date: string, targetIndex: number) => {
        mockDbState.skipCalls.push(targetIndex);
        const skipped = new Set(instance.skippedIndices);
        for (let i = instance.currentIndex; i < targetIndex; i += 1) skipped.add(i);
        return {
          ...instance,
          currentIndex: targetIndex,
          skippedIndices: [...skipped].sort((a, b) => a - b),
        };
      }),
    },
    favorites: { list: async () => [] },
  } as unknown as AppDatabase;
}

beforeEach(() => {
  registerGameDefinitions(generatedRegistry);
  resetProgressionFocusSyncForTests();
  mockDbState.db = null;
  mockDbState.skipCalls = [];
});

describe('Home plan copy and leg launches (073 §3/§4)', () => {
  it('renders a skipped leg as Skipped, never as Done', async () => {
    mockDbState.db = makeFakeDb(makeInstance());
    await renderRouter({ '/(tabs)/': HomeScreen }, { initialUrl: '/(tabs)/' });

    // Leg 0 was skipped: its own outcome, not completed work.
    expect(screen.getByTestId(`home-workout-game-status-${GAMES[0]}`)).toHaveTextContent(
      'Skipped',
    );
    // Leg 1 is current.
    expect(screen.getByTestId(`home-workout-game-status-${GAMES[1]}`)).toHaveTextContent(
      'Now',
    );
    expect(screen.getByTestId(`home-workout-game-status-${GAMES[2]}`)).toHaveTextContent(
      'Up next',
    );
  });

  it('tapping a later leg records an explicit jump before launching', async () => {
    mockDbState.db = makeFakeDb(makeInstance({ skippedIndices: [] }));
    await renderRouter({ '/(tabs)/': HomeScreen }, { initialUrl: '/(tabs)/' });

    // Tap leg 2 ("Up next"): the unplayed prefix must be recorded as skipped
    // BEFORE the launch, so the tuple the game receives is true against the
    // durable row (previously the row index was sent as if it were current).
    fireEvent.press(screen.getByTestId(`home-workout-game-${GAMES[2]}`));
    expect(mockDbState.skipCalls).toEqual([2]);
  });

  it('tapping the current leg launches without a jump', async () => {
    mockDbState.db = makeFakeDb(makeInstance({ skippedIndices: [] }));
    await renderRouter({ '/(tabs)/': HomeScreen }, { initialUrl: '/(tabs)/' });

    fireEvent.press(screen.getByTestId(`home-workout-game-${GAMES[1]}`));
    // The current leg is true by construction: no jump write happens.
    expect(mockDbState.skipCalls).toEqual([]);
  });
});
