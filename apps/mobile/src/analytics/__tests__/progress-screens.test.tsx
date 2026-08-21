/**
 * Render tests for the W09 Progress/Insights UX additions.
 *
 * Lives under the analytics feature's owned test directory (worker packet
 * ownership) but exercises the Progress screens as BARE routes with `@/db`
 * mocked, mirroring `src/app/__tests__/progress-insights.test.tsx`. Covers the
 * surfaces added in this packet: training-balance card, staleness indicator,
 * per-game recent-vs-lifetime arrow, recent-form record, lower-is-better
 * reaction trend labeling, domain personal best + window stats, and the
 * activity recency stat — plus the new-player guard that keeps the overview's
 * db-unavailable visual baseline stable.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import type {
  AppDatabase,
  DomainRating,
  GameAggregate,
  GameSessionRecord,
  RatingHistoryEntry,
} from '@/db';
import type { GameDefinition } from '@/sdk';
import ProgressScreen from '@/app/(tabs)/progress';
import ProgressGameScreen from '@/app/progress-game';
import ProgressDomainScreen from '@/app/progress-domain';
import ProgressActivityScreen from '@/app/progress-activity';
import { registerGameDefinitions } from '@/registry/registry';

const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** Minimal valid definition so registry lookups resolve a primary domain. */
const MEMORY_DEF: GameDefinition = {
  id: 'memory-match',
  name: 'Memory Match',
  primaryCategory: 'Memory',
  description: 'A memory game',
  sdkVersion: '0.1.0',
  gameVersion: '1.0.0',
  generatorVersion: '1',
  contentVersion: null,
  hasTutorial: true,
};

function renderBare(Screen: ComponentType, initialUrl: string) {
  const routeKey = initialUrl.split('?')[0].replace(/^\//, '') || 'index';
  return renderRouter({ [routeKey]: () => <Screen /> } as Record<string, ComponentType>, {
    initialUrl,
  });
}

function makeSession(over: Partial<GameSessionRecord>): GameSessionRecord {
  return {
    id: 's1',
    gameId: 'memory-match',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 1,
    difficulty: { challengeRating: 0.5 },
    rawResult: { score: 120, accuracy: 0.9, avgResponseMs: 400 },
    normalizedResult: 0.8,
    xp: 50,
    startedAt: NOW - 90_000,
    completedAt: NOW - 90_000,
    durationMs: 90_000,
    ...over,
  };
}

function makeFakeDb(over: {
  ratings?: DomainRating[];
  history?: RatingHistoryEntry[];
  recent?: GameSessionRecord[];
  aggregates?: GameAggregate[];
  byGame?: GameSessionRecord[];
  totalXp?: number;
  balance?: number;
} = {}): AppDatabase {
  const recent = over.recent ?? [];
  const byGame = over.byGame ?? recent;
  return {
    sessions: {
      getTotalXp: async () => over.totalXp ?? 0,
      getAggregates: async () => over.aggregates ?? [],
      listRecent: async () => recent,
      listByGame: async () => byGame,
      getGameAggregate: async () => null,
      getById: async () => null,
    },
    ratings: {
      getHistory: async () => over.history ?? [],
      getRatings: async () => over.ratings ?? [],
      getRating: async () => null,
    },
    ledger: { getBalance: async () => over.balance ?? 0 },
    favorites: { isFavorite: async () => false },
  } as unknown as AppDatabase;
}

describe('Progress overview — W09 additions', () => {
  beforeEach(() => {
    registerGameDefinitions([MEMORY_DEF]);
    mockDbState.db = null;
  });

  it('omits the training-balance card for a new player (baseline-stable empty state)', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderBare(ProgressScreen, '/progress');
    await result;
    expect(screen.getByTestId('progress-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('progress-balance')).toBeNull();
    expect(screen.queryByTestId('progress-last-session')).toBeNull();
  });

  it('shows training balance, staleness and per-game direction with data', async () => {
    const recent = [
      makeSession({ id: 'a', completedAt: NOW - 1 * DAY, normalizedResult: 0.9 }),
      makeSession({ id: 'b', completedAt: NOW - 2 * DAY, normalizedResult: 0.7 }),
      // Older, weaker sessions -> recent window should trend up vs lifetime.
      makeSession({ id: 'c', completedAt: NOW - 40 * DAY, normalizedResult: 0.4 }),
    ];
    const aggregates: GameAggregate[] = [
      { gameId: 'memory-match', count: 3, avgNormalized: 2 / 3, bestNormalized: 0.9, lastCompletedAt: NOW - 1 * DAY },
    ];
    mockDbState.db = makeFakeDb({
      recent,
      aggregates,
      ratings: [{ domain: 'Memory', rating: 1040, sessions: 3, updatedAt: NOW - 1 * DAY }],
      history: [
        { id: 1, sessionId: 'c', domain: 'Memory', delta: 40, ratingAfter: 1040, createdAt: NOW - 40 * DAY },
      ],
    });
    const result = renderBare(ProgressScreen, '/progress');
    await result;

    expect(screen.getByTestId('progress-balance')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-balance-bar')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-balance-memory')).toBeOnTheScreen();
    // Untrained domains are called out honestly.
    expect(screen.getByTestId('progress-balance-untrained')).toBeOnTheScreen();
    // Staleness indicator (last session yesterday).
    expect(screen.getByTestId('progress-last-session')).toHaveTextContent(/1d ago/);
    // Per-game recent-vs-lifetime direction arrow.
    expect(screen.getByTestId('progress-game-trend-memory-match')).toBeOnTheScreen();
  });
});

describe('Per-game drill-down — W09 additions', () => {
  beforeEach(() => {
    registerGameDefinitions([MEMORY_DEF]);
    mockDbState.db = null;
  });

  it('labels the reaction trend as lower-is-better and shows recent form', async () => {
    const sessions = [
      makeSession({
        id: 'a',
        completedAt: NOW - 10 * DAY,
        normalizedResult: 0.6,
        rawResult: { score: 100, accuracy: 0.8, avgResponseMs: 500 },
        durationMs: 100_000,
      }),
      makeSession({
        id: 'b',
        completedAt: NOW - 5 * DAY,
        normalizedResult: 0.8,
        rawResult: { score: 150, accuracy: 0.9, avgResponseMs: 400 },
        durationMs: 80_000,
      }),
    ];
    mockDbState.db = makeFakeDb({ byGame: sessions });
    const result = renderBare(ProgressGameScreen, '/progress-game?gameId=memory-match');
    await result;

    expect(screen.getByTestId('progress-game-trend-reaction')).toBeOnTheScreen();
    expect(screen.getByText('Reaction time (lower is better)')).toBeOnTheScreen();
    expect(screen.getByText('Last 2 avg')).toBeOnTheScreen();
    // Difficulty trend is rendered neutrally.
    expect(screen.getByText('Difficulty (challenge rating)')).toBeOnTheScreen();
  });
});

describe('Per-domain drill-down — W09 additions', () => {
  beforeEach(() => {
    registerGameDefinitions([MEMORY_DEF]);
    mockDbState.db = null;
  });

  it('shows the personal best and window stats for a trained domain', async () => {
    mockDbState.db = makeFakeDb({
      ratings: [{ domain: 'Memory', rating: 1020, sessions: 3, updatedAt: NOW - 2 * DAY }],
      history: [
        { id: 1, sessionId: 'a', domain: 'Memory', delta: 60, ratingAfter: 1060, createdAt: NOW - 20 * DAY },
        { id: 2, sessionId: 'b', domain: 'Memory', delta: -40, ratingAfter: 1020, createdAt: NOW - 2 * DAY },
      ],
      recent: [makeSession({ completedAt: NOW - 1 * DAY })],
    });
    const result = renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    await result;

    expect(screen.getByTestId('progress-domain-summary')).toBeOnTheScreen();
    // Best ever was 1060 even though current is 1020.
    expect(screen.getByTestId('progress-domain-best')).toHaveTextContent(/1060/);
    expect(screen.getByTestId('progress-domain-stats')).toBeOnTheScreen();
  });
});

describe('Activity calendar — W09 additions', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('shows days-since-last-session and active share', async () => {
    mockDbState.db = makeFakeDb({
      recent: [
        makeSession({ id: 'a', completedAt: NOW - 1 * DAY }),
        makeSession({ id: 'b', completedAt: NOW - 3 * DAY }),
      ],
    });
    const result = renderBare(ProgressActivityScreen, '/progress-activity');
    await result;
    expect(screen.getByTestId('progress-activity-summary')).toHaveTextContent(/Days since last/);
    expect(screen.getByTestId('progress-activity-share')).toBeOnTheScreen();
  });
});
