/**
 * Progress detail screen tests (WP-3F).
 *
 * Renders the real route tree (expo-router testing-library) with the `@/db`
 * module mocked to a fake AppDatabase, so the screen can be exercised with
 * empty and fabricated data. Covers the per-domain history / per-game
 * records / recent sessions sections, their empty states, the Progress tab's
 * "Full history" entry, and the per-game record link into
 * `/game-detail/[id]`.
 *
 * Notes on the mock: the factory only closes over the `mockDbState` holder
 * (it never reads the binding at factory-execution time), so it is safe
 * regardless of whether babel-plugin-jest-hoist moves the jest.mock call
 * above the imports.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import type { AppDatabase, GameAggregate, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { registerGameDefinitions } from '@/registry/registry';

/** Test-only db state holder served by the mocked `@/db` module below. */
const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    // Reject like the real sqlite path does under jest: the root layout's
    // catch swallows it (registry registration is skipped, mirroring the
    // app-shell tests) and the tree still renders.
    initDatabase: jest.fn(async () => {
      throw new Error('sqlite unavailable in tests');
    }),
  };
});

/**
 * Fake AppDatabase covering every repository method the app screens in this
 * test tree call. `overrides` seed the three progress-detail data sources;
 * everything else degrades to harmless empty results.
 */
function makeFakeDb(overrides: {
  history?: RatingHistoryEntry[];
  aggregates?: GameAggregate[];
  recent?: GameSessionRecord[];
} = {}): AppDatabase {
  const history = overrides.history ?? [];
  const aggregates = overrides.aggregates ?? [];
  const recent = overrides.recent ?? [];
  return {
    sessions: {
      getTotalXp: async () => 0,
      getAggregates: async () => aggregates,
      listRecent: async () => recent,
      listByGame: async () => [],
      getGameAggregate: async () => null,
      getById: async () => null,
    },
    ratings: {
      getHistory: async () => history,
      getRatings: async () => [],
      getRating: async () => null,
    },
    ledger: { getBalance: async () => 0 },
    favorites: { isFavorite: async () => false },
  } as unknown as AppDatabase;
}

/** Register a single fabricated game so record rows render its name. */
function registerMemoryMatch() {
  registerGameDefinitions([
    {
      id: 'memory-match',
      name: 'Memory Match',
      primaryCategory: 'Memory',
      description: 'A memory game',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1',
      hasTutorial: true,
    },
  ]);
}

describe('progress detail screen', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('renders explanatory empty states without data', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderRouter('./src/app', { initialUrl: '/progress-detail' });
    await result;

    expect(screen.getByTestId('progress-detail-title')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-back')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-domains')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-games')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-sessions')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-domains-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-games-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-sessions-empty')).toBeOnTheScreen();
  });

  it('renders domain history, game records and recent sessions from the db', async () => {
    registerMemoryMatch();
    mockDbState.db = makeFakeDb({
      // Newest first, as `ratings.getHistory` returns them.
      history: [
        { id: 3, sessionId: 's3', domain: 'Memory', delta: 12, ratingAfter: 1022, createdAt: 3_000 },
        { id: 2, sessionId: 's2', domain: 'Speed', delta: -5, ratingAfter: 995, createdAt: 2_000 },
        { id: 1, sessionId: 's1', domain: 'Memory', delta: 10, ratingAfter: 1010, createdAt: 1_000 },
      ],
      aggregates: [
        {
          gameId: 'memory-match',
          count: 3,
          avgNormalized: 0.7,
          bestNormalized: 0.9,
          lastCompletedAt: 5_000,
        },
      ],
      recent: [
        {
          id: 'r1',
          gameId: 'memory-match',
          gameVersion: 1,
          generatorVersion: 1,
          scoringVersion: 1,
          seed: 1,
          difficulty: { level: 'normal' },
          rawResult: {},
          normalizedResult: 0.9,
          xp: 50,
          startedAt: 4_000,
          completedAt: 5_000,
          durationMs: 60_000,
        },
      ],
    });
    const result = renderRouter('./src/app', { initialUrl: '/progress-detail' });
    await result;

    // Per-domain history: one block per domain, entries carry rating + delta.
    expect(screen.getByTestId('progress-detail-domain-memory')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-domain-speed')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-domain-entry-1')).toHaveTextContent(/\+10/);
    expect(screen.getByTestId('progress-detail-domain-entry-3')).toHaveTextContent(/1022/);
    expect(screen.getByTestId('progress-detail-domain-entry-2')).toHaveTextContent(/-5/);
    expect(screen.queryByTestId('progress-detail-domains-empty')).toBeNull();

    // Per-game records: name, session count and best score.
    expect(screen.queryByTestId('progress-detail-games-empty')).toBeNull();
    const gameRow = screen.getByTestId('progress-detail-game-memory-match');
    expect(within(gameRow).getByText('Memory Match')).toBeOnTheScreen();
    expect(gameRow).toHaveTextContent(/3×/);
    expect(gameRow).toHaveTextContent(/best 90%/);

    // Recent sessions: a row per session linking to the results route.
    expect(screen.queryByTestId('progress-detail-sessions-empty')).toBeNull();
    expect(screen.getByTestId('progress-detail-session-r1')).toHaveTextContent(/90%/);

    // The record row navigates to the game detail route.
    await fireEvent.press(gameRow);
    await act(async () => {});
    expect(result.getPathname()).toBe('/game-detail/memory-match');
    expect(screen.getByTestId('game-detail-title')).toBeOnTheScreen();
  });

  it('opens the detail screen from the Progress tab link', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderRouter('./src/app', { initialUrl: '/progress' });
    await result;

    expect(screen.getByTestId('progress-detail-link')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('progress-detail-link'));
    await act(async () => {});

    expect(result.getPathname()).toBe('/progress-detail');
    expect(screen.getByTestId('progress-detail-title')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-detail-sessions-empty')).toBeOnTheScreen();
  });
});
