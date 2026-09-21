/**
 * Finding 1 integration: Home, Profile and Rewards run the focus-time
 * progression sync through the shared input-aware gate.
 *
 * Proves the two required behaviors on the real screens:
 * - two rapid focus cycles (or a Rewards remount) sync once — the data reload
 *   still runs, only the expensive progression pass is skipped;
 * - a completion performed in-app (a new newest session) changes the
 *   fingerprint and forces an immediate sync on the next focus/visit, and the
 *   surface reflects the new state.
 *
 * The sync engine itself is mocked (it is pinned by the progression suite);
 * these tests pin the load-path wiring and the gate.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import HomeScreen from '@/app/(tabs)/index';
import ProfileScreen from '@/app/(tabs)/profile';
import RewardsScreen from '@/app/rewards';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { resetToastQueueForTests } from '@/components/ui';
import type { AppDatabase, AchievementUnlock, GameSessionRecord } from '@/db';
import { refreshProgression } from '@/progression';
import { resetProgressionFocusSyncForTests } from '@/progression/focus-sync';
import { registerGameDefinitions } from '@/registry/registry';
import { registry as generatedRegistry } from '@/registry/registry.generated';

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

jest.mock('@/rewards/history', () => ({
  loadRewardHistory: jest.fn(async () => []),
}));

const ACH_FIRST = (
  jest.requireActual('@/achievements') as { ACHIEVEMENT_DEFINITIONS_V1: { id: string }[] }
).ACHIEVEMENT_DEFINITIONS_V1[0];

const mockedRefreshProgression = jest.mocked(refreshProgression);

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  /** Newest persisted session; null = no sessions yet. */
  newestSession: GameSessionRecord | null;
  unlockRows: AchievementUnlock[];
} = { db: null, newestSession: null, unlockRows: [] };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return { ...actual, getDb: () => mockDbState.db };
});

function makeSession(id: string, completedAt: number): GameSessionRecord {
  return {
    id,
    gameId: 'memory',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.8,
    xp: 10,
    startedAt: completedAt - 1000,
    completedAt,
    durationMs: 1000,
  } as unknown as GameSessionRecord;
}

/** Union fake covering the three surfaces' load paths. */
function makeFakeDb(): AppDatabase {
  return {
    ratings: { getRatings: async () => [] },
    sessions: {
      listRecent: async (limit: number) =>
        mockDbState.newestSession ? [mockDbState.newestSession].slice(0, limit) : [],
      getTotalXp: async () => 0,
      getDistinctActivityDates: async () => [],
      listLightweight: async () => [],
      getAggregates: async () => [],
      listSummaries: async () => [],
      getMasteryInputs: async () => [],
      countSessions: async () => 0,
      getCount: async () => 0,
      getDistinctGameCount: async () => 0,
      getDistinctActivityDateCount: async () => 0,
      getAccuracySessionCount: async () => 0,
      getBestNormalized: async () => 0,
      getGameIdCounts: async () => ({}),
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    profile: {
      get: async () => ({ settings: {} }),
      update: async () => undefined,
    },
    achievements: { listUnlocks: async () => mockDbState.unlockRows },
    quests: {
      listProgressForQuest: async () => [],
      listProgressForPeriod: async () => [],
    },
    workouts: {
      reconcile: async () => null,
      getOrCreate: async (key: string) => ({
        date: key,
        gameIds: ['memory'],
        status: 'active',
        currentIndex: 0,
        rerollAttempt: 0,
        seedVersion: 3,
        createdAt: 0,
        updatedAt: 0,
      }),
      getByDate: async () => null,
      reconcileActiveInstances: async () => undefined,
      listHistory: async () => [],
      listRecentSummaries: async () => [],
      countCompleted: async () => 0,
    },
  } as unknown as AppDatabase;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetToastQueueForTests();
  resetProgressionFocusSyncForTests();
  registerGameDefinitions(generatedRegistry);
  mockDbState.db = makeFakeDb();
  mockDbState.newestSession = null;
  mockDbState.unlockRows = [];
});

describe('Home focus progression sync', () => {
  async function renderHome() {
    await renderRouter(
      { index: () => <HomeScreen />, progress: () => null },
      { initialUrl: '/' },
    );
    jest.useRealTimers();
    await screen.findByTestId('home-title', {}, { timeout: 10_000 });
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(1));
  }

  async function focusAwayAndBack() {
    await act(async () => {
      router.navigate('/progress');
    });
    await act(async () => {
      router.navigate('/');
    });
    await waitFor(() => expect(screen.getByTestId('home-title')).toBeOnTheScreen());
  }

  it('syncs again after the throttle window elapses with no new session', async () => {
    await renderHome();

    const base = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base + 6_000);
    try {
      await focusAwayAndBack();
      await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(2));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('syncs once for two rapid focus cycles and again after a completion', async () => {
    await renderHome();

    // Rapid bounce inside the window: the reload still runs (focus effect
    // bumps the refresh key), the progression sync does not.
    await focusAwayAndBack();
    expect(mockedRefreshProgression).toHaveBeenCalledTimes(1);

    // Completion: a new persisted session + a claimable reward. The changed
    // fingerprint wins over the window, so the next focus syncs and the quick
    // action reflects the new claimable count.
    mockDbState.newestSession = makeSession('session-2', 2_000);
    mockDbState.unlockRows = [{ achievementId: ACH_FIRST.id, unlockedAt: 0, claimedAt: null }];
    await focusAwayAndBack();
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId('home-quick-rewards')).toHaveTextContent(/Rewards \(1\)/),
    );
  });
});

describe('Profile focus progression sync', () => {
  async function renderProfile() {
    await renderRouter(
      {
        profile: () => (
          <SettingsProvider>
            <ProfileScreen />
          </SettingsProvider>
        ),
        progress: () => null,
      },
      { initialUrl: '/profile' },
    );
    jest.useRealTimers();
    await screen.findByTestId('profile-title', {}, { timeout: 10_000 });
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(1));
  }

  it('throttles rapid focus cycles and syncs after a completion', async () => {
    await renderProfile();

    await act(async () => {
      router.navigate('/progress');
    });
    await act(async () => {
      router.navigate('/profile');
    });
    await waitFor(() => expect(screen.getByTestId('profile-title')).toBeOnTheScreen());
    expect(mockedRefreshProgression).toHaveBeenCalledTimes(1);

    mockDbState.newestSession = makeSession('session-2', 2_000);
    await act(async () => {
      router.navigate('/progress');
    });
    await act(async () => {
      router.navigate('/profile');
    });
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(2));
    // The throttled path reuses the last snapshot; the loaded screen stays
    // intact (no error state) and the quest report still renders.
    expect(screen.getByTestId('profile-title')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });
});

describe('Rewards remount progression sync', () => {
  async function renderRewards() {
    await renderRouter({ rewards: () => <RewardsScreen /> }, { initialUrl: '/rewards' });
    jest.useRealTimers();
    await screen.findByTestId('rewards-title', {}, { timeout: 10_000 });
  }

  it('throttles a remount inside the window and syncs after a completion', async () => {
    await renderRewards();
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(1));
    await screen.unmount();

    // Second visit inside the window: no additional sync, but the inbox still
    // reads persisted rows (a claimable item appears without a progression
    // pass).
    mockDbState.unlockRows = [{ achievementId: ACH_FIRST.id, unlockedAt: 0, claimedAt: null }];
    await renderRewards();
    await waitFor(() =>
      expect(screen.getByTestId('rewards-title')).toBeOnTheScreen(),
    );
    expect(mockedRefreshProgression).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId(`rewards-item-${`achievement:${ACH_FIRST.id}`.replace(/[^a-zA-Z0-9]+/g, '-')}`),
    ).toBeOnTheScreen();
    await screen.unmount();

    // A completion changes the fingerprint: the next visit syncs again.
    mockDbState.newestSession = makeSession('session-2', 2_000);
    await renderRewards();
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalledTimes(2));
  });
});
