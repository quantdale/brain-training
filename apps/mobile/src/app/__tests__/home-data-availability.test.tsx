import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import HomeScreen from '@/app/(tabs)/index';
import type { AppDatabase } from '@/db';
import { resetProgressionFocusSyncForTests } from '@/progression/focus-sync';
import { registerGameDefinitions } from '@/registry/registry';
import { allowDbDataLoadLogs } from '@/test-utils';

const mockDbState: { db: AppDatabase | null } = { db: null };
jest.mock('@/db', () => ({
  ...(jest.requireActual('@/db') as Record<string, unknown>),
  getDb: () => mockDbState.db,
}));
jest.mock('@/progression', () => ({
  ...(jest.requireActual('@/progression') as Record<string, unknown>),
  refreshProgression: jest.fn(async () => ({ sessions: [], lifetime: { sessionCount: 0, totalXp: 0 } })),
}));

function database(getTotalXp: () => Promise<number>, balance = 0): AppDatabase {
  return {
    ratings: { getRatings: async () => [] },
    sessions: {
      listRecent: async () => [], getTotalXp,
      getDistinctActivityDates: async () => [], getAggregates: async () => [],
      listSummaries: async () => [], getMasteryInputs: async () => [], countSessions: async () => 0,
    },
    ledger: { getBalance: async () => balance },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    profile: { get: async () => ({ settings: {} }) },
    achievements: { listUnlocks: async () => [] }, quests: { listProgressForQuest: async () => [] },
    workouts: {
      getOrCreate: async (date: string) => ({ date, gameIds: [], status: 'active', currentIndex: 0,
        rerollAttempt: 0, seedVersion: 3, createdAt: 0, updatedAt: 0, skippedIndices: [] }),
      getByDate: async () => null, reconcile: async () => null,
      reconcileActiveInstances: async () => [], listHistory: async () => [], listRecentSummaries: async () => [],
    },
  } as unknown as AppDatabase;
}

beforeEach(() => {
  registerGameDefinitions([]);
  resetProgressionFocusSyncForTests();
  allowDbDataLoadLogs();
});

describe('Home distinguishes unread progress from genuine empty progress', () => {
  it('shows loading without invented zero XP, level, streak or first-workout history', async () => {
    mockDbState.db = database(() => new Promise<number>(() => undefined));
    await renderRouter({ index: HomeScreen }, { initialUrl: '/' });
    expect(screen.getByTestId('home-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-stat-xp')).toBeNull();
    expect(screen.queryByTestId('home-stat-level')).toBeNull();
    expect(screen.queryByTestId('home-stat-streak')).toBeNull();
    expect(screen.queryByTestId('home-streak-card-tracker')).toBeNull();
    expect(screen.queryByText('Your latest sessions will show up here after your first workout.')).toBeNull();
  });

  it('shows a recoverable unavailable state after a failed read without inventing empty history', async () => {
    mockDbState.db = database(async () => { throw new Error('fixture progress read failed'); });
    await renderRouter({ index: HomeScreen }, { initialUrl: '/' });
    await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
    expect(screen.getByTestId('home-progress-unavailable')).toHaveTextContent(/couldn't be read/i);
    expect(screen.queryByTestId('home-stat-xp')).toBeNull();
    expect(screen.queryByTestId('home-stat-level')).toBeNull();
    expect(screen.queryByTestId('home-recent-games')).toBeNull();
    expect(screen.getByTestId('home-data-retry')).toBeEnabled();
    mockDbState.db = database(async () => 186, 49);
    await fireEvent.press(screen.getByTestId('home-data-retry'));
    await waitFor(() => expect(screen.getByTestId('home-stat-xp')).toHaveTextContent('186 XP'));
    expect(screen.queryByTestId('home-progress-unavailable')).toBeNull();
  });

  it('still shows genuine zero progress after a successful first-use read', async () => {
    mockDbState.db = database(async () => 0);
    await renderRouter({ index: HomeScreen }, { initialUrl: '/' });
    await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
    expect(screen.getByTestId('home-stat-xp')).toHaveTextContent('0 XP');
    expect(screen.getByTestId('home-stat-level')).toHaveTextContent('Level 1');
    expect(screen.getByText('Your latest sessions will show up here after your first workout.')).toBeOnTheScreen();
  });

  it('shows actual retained engagement after a successful existing-profile read', async () => {
    mockDbState.db = database(async () => 186, 49);
    await renderRouter({ index: HomeScreen }, { initialUrl: '/' });
    await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
    expect(screen.getByTestId('home-stat-xp')).toHaveTextContent('186 XP');
    expect(screen.getByTestId('home-stat-level')).toHaveTextContent('Level 2');
    expect(screen.getByTestId('home-stat-coins')).toHaveTextContent('49');
  });
});
