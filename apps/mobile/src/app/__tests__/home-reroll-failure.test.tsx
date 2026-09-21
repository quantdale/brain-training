/**
 * Home reroll failure path (frontier audit `residual-user-surface-honesty`).
 *
 * Before this change `onReroll` was the raw `useWorkout().reroll`: a rejected
 * reroll (unexpected db error, apply failure) was an unhandled rejection — the
 * tap looked dead and nothing told the player whether coins were spent. Now the
 * Home wrapper surfaces a danger toast, keeps the control retryable, and the
 * workout instance/balance are untouched because the failure happened before
 * any coin debit or instance mutation.
 *
 * Renders the REAL HomeScreen with `@/db` mocked to a fake repository surface:
 * the daily instance loads with one real catalog game (so the reroll control
 * renders) and the free-reroll apply throws. Mirrors the mocking pattern of
 * home-workout-start.test.tsx.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

import HomeScreen from '@/app/(tabs)/index';
import { ToastHost, resetToastQueueForTests } from '@/components/ui';
import type { AppDatabase, WorkoutInstance } from '@/db';
import { registerGameDefinitions } from '@/registry/registry';
import { registry as generatedRegistry } from '@/registry/registry.generated';
import { resetProgressionFocusSyncForTests } from '@/progression/focus-sync';
import { expectConsoleNoise } from '@/test-utils';

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  applyRerollCalls: number;
  /** When true, the workout load-or-create pass rejects. */
  loadFails: boolean;
} = { db: null, applyRerollCalls: 0, loadFails: false };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

// Home's focus-time progression sync is mocked: the partial fake db has no
// progression catalogs, and the finding-1 gate (not the sync engine) is what
// these Home tests exercise.
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

/** One active daily instance with a real catalog game at the current leg. */
function makeDailyWorkout(): WorkoutInstance {
  return {
    date: '2026-09-14',
    gameIds: ['memory'],
    status: 'active',
    currentIndex: 0,
    rerollAttempt: 0,
    seedVersion: 3,
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeFakeDb(): AppDatabase {
  return {
    ratings: { getRatings: async () => [] },
    sessions: {
      listRecent: async () => [],
      getTotalXp: async () => 0,
      getDistinctActivityDates: async () => [],
      getAggregates: async () => [],
      listSummaries: async () => [],
      countSessions: async () => 0,
      listLightweight: async () => [],
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    profile: { get: async () => ({ settings: {} }) },
    achievements: { listUnlocks: async () => [] },
    quests: { listProgressForQuest: async () => [] },
    workouts: {
      reconcile: async () => {
        if (mockDbState.loadFails) {
          throw new Error('workout load boom');
        }
        return null;
      },
      getOrCreate: async () => {
        if (mockDbState.loadFails) {
          throw new Error('workout load boom');
        }
        return makeDailyWorkout();
      },
      getByDate: async () => makeDailyWorkout(),
      applyReroll: async () => {
        mockDbState.applyRerollCalls += 1;
        throw new Error('reroll boom');
      },
      reconcileActiveInstances: async () => undefined,
      listHistory: async () => [],
      listRecentSummaries: async () => [],
    },
  } as unknown as AppDatabase;
}

async function renderHome() {
  mockDbState.db = makeFakeDb();
  mockDbState.applyRerollCalls = 0;
  mockDbState.loadFails = false;
  await renderRouter(
    {
      index: () => (
        <>
          <ToastHost />
          <HomeScreen />
        </>
      ),
    },
    { initialUrl: '/' },
  );
  jest.useRealTimers();
  await screen.findByTestId('home-workout-reroll', {}, { timeout: 10_000 });
}

beforeEach(() => {
  registerGameDefinitions(generatedRegistry);
  resetProgressionFocusSyncForTests();
  resetToastQueueForTests();
});

describe('home workout reroll failure path', () => {
  it('surfaces the rejection, keeps the control retryable, and changes nothing', async () => {
    await renderHome();

    // The deliberate reroll-failure diagnostic is scoped to this test.
    await expectConsoleNoise(/\[home\] workout reroll failed/, async () => {
      await fireEvent.press(screen.getByTestId('home-workout-reroll'));
      await waitFor(() => expect(mockDbState.applyRerollCalls).toBe(1));
      await screen.findByTestId('toast', {}, { timeout: 5000 });
    });

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveTextContent(/Couldn't reroll the workout/);
    expect(toast).toHaveTextContent(/coins were not spent/);

    // Retryable: the in-flight guard reset, so a second tap reaches the seam
    // and re-exercises the same deliberate failure diagnostic.
    await expectConsoleNoise(/\[home\] workout reroll failed/, async () => {
      await fireEvent.press(screen.getByTestId('home-workout-reroll'));
      await waitFor(() => expect(mockDbState.applyRerollCalls).toBe(2));
    });

    // The failed reroll never removed the plan legs or spent coins (the free
    // first reroll would debit nothing even on success).
    expect(screen.getByTestId('home-workout-continue')).toBeOnTheScreen();
  });

  it('does not present a failed workout load as "no games registered", and retry recovers', async () => {
    mockDbState.loadFails = true;
    mockDbState.db = makeFakeDb();
    // The deliberate workout-load-failure diagnostic is scoped to this test.
    await expectConsoleNoise(/\[workout\] load failed/, async () => {
      await renderRouter(
        {
          index: () => (
            <>
              <ToastHost />
              <HomeScreen />
            </>
          ),
        },
        { initialUrl: '/' },
      );
      jest.useRealTimers();
      await screen.findByTestId('home-workout-error', {}, { timeout: 10_000 });
    });

    // A failure must not use the empty-catalog copy.
    expect(screen.queryByTestId('home-workout-empty')).toBeNull();
    expect(screen.queryByTestId('home-workout-loading')).toBeNull();

    // Recovery: clearing the injected failure and retrying renders the plan.
    mockDbState.loadFails = false;
    await fireEvent.press(screen.getByTestId('home-workout-retry'));

    expect(
      await screen.findByTestId('home-workout-reroll', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('home-workout-error')).toBeNull();
  });
});
