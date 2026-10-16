import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';
import ProfileScreen from '@/app/(tabs)/profile';
import { resetReducedMotionStoreForTests } from '@/components/a11y/reduced-motion';
import { SettingsProvider } from '@/components/settings/settings-provider';
import type { AppDatabase, AchievementUnlock } from '@/db';
import { resetProgressionFocusSyncForTests } from '@/progression/focus-sync';
import { expectConsoleNoise } from '@/test-utils';

let mockFocusCallback: (() => void) | undefined;
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useFocusEffect: (callback: () => void) => { mockFocusCallback = callback; },
  useSegments: () => ['(tabs)'],
}));

const mockReadXp = jest.fn<() => Promise<number>>();
const mockDbState: {
  db: AppDatabase | null;
  balance: number;
  unlocks: AchievementUnlock[];
} = { db: null, balance: 49, unlocks: [] };
jest.mock('@/db', () => ({
  ...(jest.requireActual('@/db') as Record<string, unknown>),
  getDb: () => mockDbState.db,
}));

// Keep the expensive progression aggregators deterministic, as in the Profile
// purchase suite. Profile's loader, reward collector and useDbData are REAL.
jest.mock('@/progression', () => ({
  ...(jest.requireActual('@/progression') as Record<string, unknown>),
  refreshProgression: jest.fn(async () => ({
    sessions: [], lifetime: { sessionCount: 0, totalXp: 0 },
  })),
  buildAchievementSnapshot: jest.fn(async () => ({
    sessionCount: 0, totalXp: 0, domainSessions: {}, longestStreak: 0,
    perfectSessions: 0, distinctGames: 0, domainCoverage: 0, activeDays: 0,
    accuracySessions: 0, bestNormalized: 0, workoutsCompleted: 0,
  })),
}));

const ACHIEVEMENT = ACHIEVEMENT_DEFINITIONS_V1[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function database(): AppDatabase {
  return {
    ledger: { getBalance: async () => mockDbState.balance },
    profile: { get: async () => ({ displayName: 'Alex', settings: {} }) },
    achievements: { listUnlocks: async () => mockDbState.unlocks },
    quests: {
      listProgressForPeriod: async () => [],
      listProgressForQuest: async () => [],
    },
    sessions: {
      listRecent: async () => [],
      getTotalXp: () => mockReadXp(),
      getDistinctActivityDates: async () => [],
    },
    xpAwards: { getTotalAwardedXp: async () => 0 },
  } as unknown as AppDatabase;
}

async function renderProfile() {
  await render(<SettingsProvider><ProfileScreen /></SettingsProvider>);
}

async function focusProfile() {
  expect(mockFocusCallback).toBeDefined();
  await act(async () => { mockFocusCallback!(); });
  await waitFor(() => expect(mockReadXp).toHaveBeenCalledTimes(2));
}

beforeEach(() => {
  jest.clearAllMocks();
  resetReducedMotionStoreForTests();
  // This suite observes pending database reads, not animation frames. Seed the
  // real motion store with the platform's static preference so decorative
  // animation timers cannot update views outside the data assertions' act().
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  resetProgressionFocusSyncForTests();
  mockFocusCallback = undefined;
  mockReadXp.mockResolvedValue(186);
  mockDbState.balance = 49;
  mockDbState.unlocks = [{ achievementId: ACHIEVEMENT.id, unlockedAt: 0, claimedAt: null }];
  mockDbState.db = database();
});

afterEach(() => {
  resetReducedMotionStoreForTests();
  jest.restoreAllMocks();
});

describe('Profile real data reads during refresh', () => {
  it('keeps observed engagement and the mounted disclosure during focus refresh, then renders fresh data', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^186Total XP$/));
    expect(screen.getByTestId('profile-rewards-pending')).toHaveTextContent('1 ready');
    await fireEvent.press(screen.getByTestId('profile-achievements-toggle'));
    const record = screen.getByTestId(`profile-achievement-${ACHIEVEMENT.id}`);

    const refreshRead = deferred<number>();
    mockReadXp.mockImplementationOnce(() => refreshRead.promise);
    mockDbState.balance = 55;
    await focusProfile();

    expect(screen.queryByTestId('profile-loading')).toBeNull();
    expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^186Total XP$/);
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(/^49Coins$/);
    expect(screen.getByTestId('profile-metric-level')).toHaveTextContent('Level 2');
    expect(screen.getByTestId('profile-rewards-pending')).toHaveTextContent('1 ready');
    expect(screen.queryByText('No XP yet — play a game to start your level.')).toBeNull();
    expect(screen.queryByText('No rewards waiting')).toBeNull();
    expect(screen.getByTestId('profile-achievements-toggle').props.accessibilityState.expanded).toBe(true);
    expect(screen.getByTestId(`profile-achievement-${ACHIEVEMENT.id}`)).toBe(record);

    await act(async () => { refreshRead.resolve(260); });
    await waitFor(() => expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^260Total XP$/));
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(/^55Coins$/);
    expect(screen.getByTestId(`profile-achievement-${ACHIEVEMENT.id}`)).toBe(record);
  });

  it('reports a failed focus refresh instead of claiming a fresh or empty profile', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^186Total XP$/));
    const refreshRead = deferred<number>();
    mockReadXp.mockImplementationOnce(() => refreshRead.promise);
    await focusProfile();
    await expectConsoleNoise(/\[useDbData\] profile load failed/, async () => {
      await act(async () => { refreshRead.reject(new Error('profile refresh unavailable')); });
      expect(screen.getByTestId('profile-error')).toBeOnTheScreen();
      expect(screen.getByText("Couldn't load your profile")).toBeOnTheScreen();
    });
    expect(screen.queryByTestId('profile-metric-xp')).toBeNull();
    expect(screen.queryByTestId('profile-metric-coins')).toBeNull();
    expect(screen.queryByText('No XP yet — play a game to start your level.')).toBeNull();
    expect(screen.queryByText('No rewards waiting')).toBeNull();
  });

  it('uses a first-read skeleton until any profile has actually been observed', async () => {
    const initialRead = deferred<number>();
    mockReadXp.mockImplementationOnce(() => initialRead.promise);
    await renderProfile();
    expect(screen.getByTestId('profile-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-metric-xp')).toBeNull();
    expect(screen.queryByTestId('profile-rewards-pending')).toBeNull();
    expect(screen.queryByText('No XP yet — play a game to start your level.')).toBeNull();
    await act(async () => { initialRead.resolve(186); });
    await waitFor(() => expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^186Total XP$/));
  });

  it('still renders a genuinely empty successfully read profile', async () => {
    mockReadXp.mockResolvedValue(0);
    mockDbState.balance = 0;
    mockDbState.unlocks = [];
    await renderProfile();
    await waitFor(() => expect(screen.queryByTestId('profile-loading')).toBeNull());
    expect(screen.getByTestId('profile-metric-xp')).toHaveTextContent(/^0Total XP$/);
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(/^0Coins$/);
    expect(screen.getByText('No XP yet — play a game to start your level.')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-rewards-pending')).toHaveTextContent('No rewards waiting');
  });
});
