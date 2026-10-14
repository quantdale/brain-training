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

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import type { GameDefinition } from '@/sdk';
import { StyleSheet } from 'react-native';

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
import { allowDbDataLoadLogs } from '@/test-utils';

const mockDbState: { db: AppDatabase | null } = { db: null };
const mockViewport = { width: 390, height: 844, scale: 1, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockViewport,
}));
const MEMORY_DEF: GameDefinition = {
  id: 'memory', name: 'Memory', primaryCategory: 'Memory', description: 'A memory game',
  sdkVersion: '0.1.0', gameVersion: '1.0.0', generatorVersion: '1', contentVersion: null, hasTutorial: true,
};


jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

// Frozen per test: the screens compare fixture timestamps against Date.now()
// during render, so capturing the real clock at module import made recency and
// staleness expectations boundary-sensitive (campaign 065 hygiene).
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  Object.assign(mockViewport, { width: 390, height: 844, scale: 1, fontScale: 1 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

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
  /** When set, the primary ratings read rejects (load-failure injection). */
  loadError?: Error;
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
      getRatings: async () => {
        if (over.loadError) {
          throw over.loadError;
        }
        return over.ratings ?? [];
      },
      getRating: async () => null,
    },
    xpAwards: { getTotalAwardedXp: async () => 0 },
    ledger: { getBalance: async () => over.balance ?? 0 },
    favorites: { isFavorite: async () => false },
  } as unknown as AppDatabase;
}

// 072: this suite deliberately exercises load-failure paths (db-unavailable
// fallbacks, retries, partial mocks), and `useDbData` logs each one. Declared
// per test, because the console gate clears its expectations between tests.
// Anything else logged here still fails the gate.
beforeEach(() => {
  allowDbDataLoadLogs();
});

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
    expect(screen.getByTestId('progress-answers')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-consistency')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-movement')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-focus')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-memory')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-speed')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-activity')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-recent')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-attention')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-memory')).toBeOnTheScreen();
  });

  it('leads with current rating and preserves detailed insights behind an explicit disclosure', async () => {
    mockDbState.db = makeFakeDb({ recent: [makeSession({ normalizedResult: 0.2 })], totalXp: 50 });
    await renderBare(ProgressScreen, '/progress');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"testID":"progress-composite"')).toBeLessThan(tree.indexOf('"testID":"progress-window-selector-row"'));
    expect(within(screen.getByTestId('progress-composite')).queryByText(/vs your lifetime/)).toBeNull();
    expect(screen.queryByTestId('progress-summary')).toBeNull();
    await fireEvent.press(screen.getByTestId('progress-insights-toggle'));
    expect(screen.getByTestId('progress-summary')).toHaveTextContent(/50/);
    await fireEvent.press(screen.getByTestId('progress-insights-toggle'));
    expect(screen.queryByTestId('progress-summary')).toBeNull();
  });

  it('058: text links meet the touch floor by style, not by accident', async () => {
    const ratings: DomainRating[] = [
      { domain: 'Memory', rating: 1040, sessions: 5, updatedAt: NOW - 2 * DAY },
    ];
    mockDbState.db = makeFakeDb({ ratings });
    const result = renderBare(ProgressScreen, '/progress');
    await result;
    const linkStyle = StyleSheet.flatten(
      screen.getByTestId('progress-activity-link').props.style,
    ) as { minHeight?: number };
    expect(linkStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('058: missing-domain back link meets the touch floor', async () => {
    mockDbState.db = makeFakeDb();
    const result = renderBare(ProgressDomainScreen, '/progress-domain?domain=Bogus');
    await result;
    expect(screen.getByTestId('progress-domain-missing')).toBeOnTheScreen();
    const backStyle = StyleSheet.flatten(
      screen.getByTestId('progress-domain-back-link').props.style,
    ) as { minHeight?: number };
    expect(backStyle.minHeight).toBeGreaterThanOrEqual(44);
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

  it('distinguishes a load failure from the new-player empty state, and retry recovers', async () => {
    mockDbState.db = makeFakeDb({ loadError: new Error('snapshot boom') });
    const result = renderBare(ProgressScreen, '/progress');
    await result;

    // The failure must not read as "No sessions yet".
    expect(await screen.findByTestId('progress-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('progress-empty')).toBeNull();

    // Recovery: clearing the injected failure and pressing Try again reruns the
    // real load path, which then renders the genuine empty state.
    mockDbState.db = makeFakeDb();
    await fireEvent.press(screen.getByTestId('progress-error-action'));

    expect(
      await screen.findByTestId('progress-empty', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('progress-error')).toBeNull();
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

  it.each([{ width: 320, fontScale: 1 }, { width: 390, fontScale: 2 }])('reflows game records at $width dp / $fontScale text', async (viewport) => {
    Object.assign(mockViewport, viewport);
    mockDbState.db = makeFakeDb({ byGame: [makeSession({})] });
    await renderBare(ProgressGameScreen, '/progress-game?gameId=memory');
    expect(StyleSheet.flatten(screen.getByTestId('progress-game-records-layout').props.style).flexDirection).toBe('column');
    expect(screen.getByText('Best accuracy')).toBeOnTheScreen();
    expect(screen.getByText('Best reaction')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('progress-game-title').props.style).flexShrink).toBe(1);
  });

  it('scopes the real recent comparison to the selected window and names the All fallback', async () => {
    const byGame = [
      makeSession({ id: 'latest', completedAt: NOW - DAY, normalizedResult: 0.9, rawResult: {} }),
      makeSession({ id: 'middle', completedAt: NOW - 10 * DAY, normalizedResult: 0.7, rawResult: {} }),
      makeSession({ id: 'old', completedAt: NOW - 100 * DAY, normalizedResult: 0.2, rawResult: {} }),
    ];
    mockDbState.db = makeFakeDb({ byGame });
    await renderBare(ProgressGameScreen, '/progress-game?gameId=memory');
    const comparison = () => within(screen.getByTestId('progress-game-rvl'));
    expect(comparison().getByText('80%')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('progress-game-window-7d'));
    expect(comparison().getByText('90%')).toBeOnTheScreen();
    expect(comparison().getByText('60%')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-trend-summary')).toHaveTextContent(/all-time series/);
    await fireEvent.press(screen.getByTestId('progress-game-window-all'));
    expect(comparison().getByText('80%')).toBeOnTheScreen();
    expect(comparison().getByText(/All uses a 90-day recent comparison/)).toBeOnTheScreen();
    expect(screen.getByTestId('progress-game-window-scope')).toHaveTextContent(/last 90 days/);
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

  it('does not stack empty charts and activity after an untrained domain state', async () => {
    mockDbState.db = makeFakeDb();
    await renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    expect(screen.getByTestId('progress-domain-unseen')).toHaveTextContent(/starting rating \(1000\)/);
    expect(screen.queryByTestId('progress-domain-window-row')).toBeNull();
    expect(screen.queryByTestId('progress-domain-history')).toBeNull();
    expect(screen.queryByTestId('progress-domain-activity')).toBeNull();
    expect(screen.queryByTestId('progress-domain-recent')).toBeNull();
  });

  it('changes domain movement and session facts with the selected window while preserving current rating', async () => {
    registerGameDefinitions([MEMORY_DEF]);
    mockDbState.db = makeFakeDb({
      ratings: [{ domain: 'Memory', rating: 1040, sessions: 2, updatedAt: NOW - DAY }],
      history: [
        { id: 2, sessionId: 'new', domain: 'Memory', delta: 20, ratingAfter: 1040, createdAt: NOW - DAY },
        { id: 1, sessionId: 'old', domain: 'Memory', delta: 20, ratingAfter: 1020, createdAt: NOW - 10 * DAY },
      ],
      recent: [makeSession({ id: 'new', completedAt: NOW - DAY }), makeSession({ id: 'old', completedAt: NOW - 10 * DAY })],
    });
    await renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    expect(screen.getByTestId('progress-domain-movement')).toHaveTextContent(/\+20/);
    expect(within(screen.getByTestId('progress-domain-stats')).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('progress-domain-window-7d'));
    expect(screen.queryByTestId('progress-domain-movement')).toBeNull();
    expect(within(screen.getByTestId('progress-domain-stats')).getByText('1')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-domain-summary')).toHaveTextContent(/1040/);
  });

  it('labels rating slope in rating points per day without percentage scaling', async () => {
    mockDbState.db = makeFakeDb({
      ratings: [{ domain: 'Memory', rating: 1040, sessions: 2, updatedAt: NOW - DAY }],
      history: [
        { id: 2, sessionId: 'new', domain: 'Memory', delta: 20, ratingAfter: 1040, createdAt: NOW - DAY },
        { id: 1, sessionId: 'old', domain: 'Memory', delta: 20, ratingAfter: 1020, createdAt: NOW - 11 * DAY },
      ],
    });
    await renderBare(ProgressDomainScreen, '/progress-domain?domain=Memory');
    const trend = within(screen.getByTestId('progress-domain-trend'));
    expect(trend.getByText('Rating points / day')).toBeOnTheScreen();
    expect(trend.getByText('+2')).toBeOnTheScreen();
    expect(trend.queryByText('+200')).toBeNull();
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

  it.each([{ width: 320, fontScale: 1 }, { width: 390, fontScale: 2 }])('stacks essential activity facts at $width dp / $fontScale text', async (viewport) => {
    Object.assign(mockViewport, viewport);
    mockDbState.db = makeFakeDb({ recent: [makeSession({ id: 'a', completedAt: NOW - DAY })] });
    await renderBare(ProgressActivityScreen, '/progress-activity');
    expect(StyleSheet.flatten(screen.getByTestId('progress-activity-summary-layout').props.style).flexDirection).toBe('column');
    expect(screen.getByTestId('progress-activity-summary')).toHaveTextContent(/Sessions/);
    expect(screen.getByTestId('progress-activity-summary')).toHaveTextContent(/Active days/);
    expect(screen.getByTestId('progress-activity-share')).toHaveTextContent(/Last session 1 day ago/);
    expect(screen.getByTestId('progress-activity-heatmap')).toBeOnTheScreen();
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
