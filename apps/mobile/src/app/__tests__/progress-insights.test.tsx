/**
 * Progress / Insights render tests (Wave 01-03).
 *
 * Exercises each screen as a BARE route (no `(tabs)` / root layout) with `@/db`
 * mocked to a fake AppDatabase, mirroring `visual-baselines.test.tsx`. This keeps
 * the renders deterministic and avoids the full app startup tree. Covers the
 * enhanced overview, the per-domain and per-game drill-downs, and the activity
 * calendar — including new-player / empty states. Pure aggregation is covered
 * separately in `src/analytics/__tests__/analytics.test.ts`.
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

/** Render one screen as a bare route so no tab host / layout enters the tree. */
function renderBare(Screen: ComponentType, initialUrl: string) {
  const routeKey = initialUrl.split('?')[0].replace(/^\//, '') || 'index';
  return renderRouter({ [routeKey]: () => <Screen /> } as Record<string, ComponentType>, {
    initialUrl,
  });
}

function makeSession(over: Partial<GameSessionRecord>): GameSessionRecord {
  return {
    id: 's1',
    gameId: 'memory',
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
    xpAwards: { getTotalAwardedXp: async () => 0 },
    ledger: { getBalance: async () => over.balance ?? 0 },
    favorites: { isFavorite: async () => false },
  } as unknown as AppDatabase;
}

describe('Progress overview', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('renders an explanatory empty state for a new player', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderBare(ProgressScreen, '/progress');
    await result;
    expect(screen.getByTestId('progress-title')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-composite-value')).toHaveTextContent('1000');
    expect(screen.queryByTestId('progress-detail-link')).toBeOnTheScreen();
  });

  it('renders composite, domain cards, activity and recent-vs-lifetime with data', async () => {
    const ratings: DomainRating[] = [
      { domain: 'Memory', rating: 1040, sessions: 5, updatedAt: NOW - 2 * DAY },
      { domain: 'Speed', rating: 980, sessions: 2, updatedAt: NOW - 60 * DAY },
    ];
    const history: RatingHistoryEntry[] = [
      { id: 1, sessionId: 'a', domain: 'Memory', delta: 20, ratingAfter: 1020, createdAt: NOW - 30 * DAY },
      { id: 2, sessionId: 'b', domain: 'Memory', delta: 20, ratingAfter: 1040, createdAt: NOW - 2 * DAY },
    ];
    const recent = [
      makeSession({ id: 'a', gameId: 'memory', completedAt: NOW - 1 * DAY, normalizedResult: 0.9 }),
      makeSession({ id: 'b', gameId: 'memory', completedAt: NOW - 5 * DAY, normalizedResult: 0.7 }),
    ];
    const aggregates: GameAggregate[] = [
      { gameId: 'memory', count: 2, avgNormalized: 0.8, bestNormalized: 0.9, lastCompletedAt: NOW - 1 * DAY },
    ];
    mockDbState.db = makeFakeDb({ ratings, history, recent, aggregates, totalXp: 100, balance: 10 });
    const result = renderBare(ProgressScreen, '/progress');
    await result;

    expect(screen.getByTestId('progress-composite-value')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-memory')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-speed')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-activity')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-recent')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-attention')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-memory')).toBeOnTheScreen();
  });

  it('shows the 7d/30d/90d/all window selector', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderBare(ProgressScreen, '/progress');
    await result;
    expect(screen.getByTestId('progress-window-7d')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-window-30d')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-window-90d')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-window-all')).toBeOnTheScreen();
  });
});

describe('Per-game drill-down', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('shows records and available-metric trends for a played game', async () => {
    const sessions = [
      makeSession({ id: 'a', completedAt: NOW - 10 * DAY, normalizedResult: 0.6, rawResult: { score: 100, accuracy: 0.8 }, durationMs: 100_000 }),
      makeSession({ id: 'b', completedAt: NOW - 5 * DAY, normalizedResult: 0.8, rawResult: { score: 150, accuracy: 0.9 }, durationMs: 80_000 }),
    ];
    mockDbState.db = makeFakeDb({ byGame: sessions });
    const result = renderBare(ProgressGameScreen, '/progress-game?gameId=memory');
    await result;

    expect(screen.getByTestId('progress-game-title')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-records')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-trend-normalized')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-trend-score')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-trend-accuracy')).toBeOnTheScreen();
    // No reaction field in this fixture -> trend correctly omitted.
    expect(screen.queryByTestId('progress-game-trend-reaction')).toBeNull();
  });

  it('renders an empty state when the game has no sessions', async () => {
    mockDbState.db = makeFakeDb({ byGame: [] });
    const result = renderBare(ProgressGameScreen, '/progress-game?gameId=memory');
    await result;
    expect(screen.getByTestId('progress-game-empty')).toBeOnTheScreen();
  });
});

describe('Per-domain drill-down', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('explains an untrained domain', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    await result;
    expect(screen.getByTestId('progress-domain-title')).toHaveTextContent('Memory');
    expect(screen.getByTestId('progress-domain-unseen')).toBeOnTheScreen();
  });

  it('shows rating and history for a trained domain', async () => {
    const ratings: DomainRating[] = [
      { domain: 'Memory', rating: 1040, sessions: 3, updatedAt: NOW - 2 * DAY },
    ];
    const history: RatingHistoryEntry[] = [
      { id: 1, sessionId: 'a', domain: 'Memory', delta: 40, ratingAfter: 1040, createdAt: NOW - 2 * DAY },
    ];
    mockDbState.db = makeFakeDb({ ratings, history, recent: [makeSession({ gameId: 'memory' })] });
    const result = renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    await result;
    expect(screen.getByTestId('progress-domain-summary')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-history')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-games')).toBeOnTheScreen();
  });
});

describe('Activity calendar', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
    mockDbState.db = null;
  });

  it('renders heatmap and frequency for trained history', async () => {
    const recent = [
      makeSession({ id: 'a', completedAt: NOW - 1 * DAY }),
      makeSession({ id: 'b', completedAt: NOW - 1 * DAY }),
      makeSession({ id: 'c', completedAt: NOW - 3 * DAY }),
    ];
    mockDbState.db = makeFakeDb({ recent });
    const result = renderBare(ProgressActivityScreen, '/progress-activity');
    await result;
    expect(screen.getByTestId('progress-activity-title')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-activity-summary')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-activity-heatmap')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-activity-distribution')).toBeOnTheScreen();
  });
});
