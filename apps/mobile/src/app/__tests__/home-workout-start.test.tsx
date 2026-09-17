/**
 * Home template-workout start failure path (campaign 028 W1).
 *
 * Pins what the Home "More workouts" CTA does when the workout start seam
 * (`useWorkoutTemplates.startTemplate` -> `WorkoutRepository.getOrCreate`)
 * REJECTS: before Campaign 028 the rejection was swallowed by a console-only
 * catch, the tap looked dead and nothing told the player whether an instance
 * was created. Now a danger toast is the user-visible surface, the screen
 * stays on Home, and the `finally` reset keeps the CTA retryable.
 *
 * Renders the REAL HomeScreen via expo-router testing-library with `@/db`
 * mocked to a fake repository surface: the daily-workout read succeeds (so the
 * screen reaches its loaded state) while the first TEMPLATE-key `getOrCreate`
 * throws. Mirrors the mocking pattern of results-workout-cta.test.tsx and
 * visual-baselines.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  /** Template-key `getOrCreate` attempts (fails every time, counting retries). */
  templateStartAttempts: number;
} = { db: null, templateStartAttempts: 0 };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

/** Minimal persisted daily instance so the primary read path succeeds. */
function makeDailyWorkout(key: string): WorkoutInstance {
  return {
    date: key,
    gameIds: [],
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
      getMasteryInputs: async () => [],
      countSessions: async () => 0,
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    profile: { get: async () => ({ settings: {} }) },
    achievements: { listUnlocks: async () => [] },
    quests: { listProgressForQuest: async () => [] },
    workouts: {
      reconcile: async () => null,
      getOrCreate: jest.fn(async (key: string) => {
        // Template instance keys are `<date>::<templateId>::<length>`; the
        // daily path keeps the bare date. Only the template start rejects.
        if (key.includes('::')) {
          mockDbState.templateStartAttempts += 1;
          throw new Error('template start boom');
        }
        return makeDailyWorkout(key);
      }),
      getByDate: async () => null,
      reconcileActiveInstances: async () => undefined,
      listHistory: async () => [],
      listRecentSummaries: async () => [],
    },
  } as unknown as AppDatabase;
}

async function renderHome() {
  mockDbState.db = makeFakeDb();
  mockDbState.templateStartAttempts = 0;
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
  await screen.findByTestId('home-title', {}, { timeout: 10_000 });
}

beforeEach(() => {
  // The real app registers the catalog in _layout.tsx; this minimal route map
  // must do it explicitly or the "More workouts" section never mounts.
  registerGameDefinitions(generatedRegistry);
  resetToastQueueForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('home template-workout start failure path', () => {
  it('explains the local offline first-run path', async () => {
    await renderHome();

    expect(screen.getByTestId('home-local-trust')).toHaveTextContent(
      /ready on this device and works offline/i,
    );
  });

  it('surfaces a failed start, stays on Home, and keeps the CTA retryable', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderHome();

    const start = await screen.findByTestId(
      'home-workout-template-start',
      {},
      { timeout: 10_000 },
    );
    await fireEvent.press(start);

    await waitFor(() => expect(mockDbState.templateStartAttempts).toBe(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[home] template workout start failed',
        expect.any(Error),
      ),
    );

    // Campaign 028: the rejection is user-visible now, and no instance was
    // created so nothing was changed.
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't start the workout/);
    expect(screen.getByTestId('home-title')).toBeOnTheScreen();

    // Retryable: the `finally` reset re-enabled the CTA, so a second tap
    // reaches the start seam again instead of being silently swallowed.
    await fireEvent.press(
      screen.getByTestId('home-workout-template-start'),
    );
    await waitFor(() => expect(mockDbState.templateStartAttempts).toBe(2));
  });
});
