/**
 * Games library render contract (Campaign 024).
 *
 * Exercises `GamesScreen` as a bare route with `@/db` mocked to an empty
 * store: featured hero, search/filter chips, tier-agnostic grid testIDs, the
 * discovery rail with its "See all" expansion, and both empty states. Card
 * accessibility (role + name including game and category) is asserted through
 * the label query, mirroring how a screen reader meets each card.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import GamesScreen from '@/app/(tabs)/games';
import type { AppDatabase } from '@/db';
import { registerGameDefinitions, type GameDefinition } from '@/registry/registry';

const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

function makeGame(
  id: string,
  name: string,
  primaryCategory: GameDefinition['primaryCategory'],
  description = `${name} trains your brain.`,
): GameDefinition {
  return {
    id,
    name,
    primaryCategory,
    description,
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    contentVersion: null,
    hasTutorial: false,
  };
}

const GAMES: GameDefinition[] = [
  makeGame('memory-alpha', 'Memory Alpha', 'Memory'),
  makeGame('memory-beta', 'Memory Beta', 'Memory'),
  makeGame('attention-evo', 'Attention Evo', 'Attention'),
  makeGame('speed-sprint', 'Speed Sprint', 'Speed'),
  makeGame('logic-prime', 'Logic Prime', 'Logic & Problem Solving'),
  makeGame('logic-duo', 'Logic Duo', 'Logic & Problem Solving'),
];

function makeFakeDb(): AppDatabase {
  return {
    sessions: {
      getAggregates: async () => [],
      listSummaries: async () => [],
      getMasteryInputs: async () => [],
    },
    ratings: {
      getRatings: async () => [],
    },
    favorites: {
      listFavoriteGameIds: async () => [],
    },
  } as unknown as AppDatabase;
}

function LibraryScreen() {
  return <GamesScreen />;
}

async function renderLibrary() {
  // renderRouter enables fake timers internally; without switching back,
  // RNTL's findBy* burns its whole wait budget almost instantly (see
  // data-management.test.tsx `renderScreen`).
  await renderRouter({ games: LibraryScreen }, { initialUrl: '/games' });
  jest.useRealTimers();
}

describe('games library', () => {
  beforeEach(() => {
    registerGameDefinitions(GAMES);
    mockDbState.db = makeFakeDb();
  });

  it('leads with the featured hero and the full searchable library', async () => {
    await renderLibrary();

    expect(await screen.findByTestId('games-title')).toBeOnTheScreen();
    expect(screen.getByTestId('games-search')).toBeOnTheScreen();
    expect(screen.getByTestId('games-filters')).toBeOnTheScreen();
    expect(screen.getByTestId('games-filter-all')).toBeOnTheScreen();
    expect(screen.getByTestId('games-filter-memory')).toBeOnTheScreen();
    expect(screen.getByTestId('games-filter-favorites')).toBeOnTheScreen();

    // Hero leads with the top recommendation (novelty orders the fresh
    // catalog in registry order) and names the game.
    const hero = screen.getByTestId('games-featured');
    expect(within(hero).getByText('Memory Alpha')).toBeOnTheScreen();

    // Grid carries one card per game under the stable card testIDs.
    expect(screen.getByTestId('games-grid')).toBeOnTheScreen();
    for (const game of GAMES) {
      expect(screen.getByTestId(`game-card-${game.id}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('games-count')).toHaveTextContent('Showing 6 of 6 games');
  });

  it('exposes every card to assistive technology by name and category', async () => {
    await renderLibrary();

    await screen.findByTestId('games-grid');
    // Unplayed catalog ⇒ tier badge reads "New"; favourite absent. The rail
    // card shares the accessible name, so scope the query to the grid.
    const grid = screen.getByTestId('games-grid');
    expect(
      within(grid).getByLabelText('Memory Alpha, Memory game, New'),
    ).toBeOnTheScreen();
    expect(
      within(grid).getByLabelText('Speed Sprint, Speed game, New'),
    ).toBeOnTheScreen();
  });

  it('filters by category chip and restores with All', async () => {
    await renderLibrary();

    await screen.findByTestId('games-grid');
    fireEvent.press(screen.getByTestId('games-filter-memory'));
    expect(await screen.findByText('Showing 2 of 6 games')).toBeOnTheScreen();
    expect(screen.getByTestId('game-card-memory-alpha')).toBeOnTheScreen();
    expect(screen.getByTestId('game-card-memory-beta')).toBeOnTheScreen();
    expect(screen.queryByTestId('game-card-speed-sprint')).toBeNull();
    // Discovery rails never compete with an intentional lookup.
    expect(screen.queryByTestId('games-featured')).toBeNull();
    expect(screen.queryByTestId('games-discovery')).toBeNull();

    fireEvent.press(screen.getByTestId('games-filter-all'));
    expect(await screen.findByText('Showing 6 of 6 games')).toBeOnTheScreen();
  });

  it('searches by text with a clear recovery action', async () => {
    await renderLibrary();

    await screen.findByTestId('games-grid');
    expect(screen.queryByTestId('games-search-clear')).toBeNull();

    fireEvent.changeText(screen.getByTestId('games-search'), 'speed');
    expect(await screen.findByText('Showing 1 of 6 games')).toBeOnTheScreen();
    expect(screen.getByTestId('game-card-speed-sprint')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('games-search-clear'));
    expect(await screen.findByText('Showing 6 of 6 games')).toBeOnTheScreen();
  });

  it('renders the recommendation rail collapsed with a working See all', async () => {
    await renderLibrary();

    // Hero takes the first pick; the rail lists the rest, collapsed to three.
    const shelf = await screen.findByTestId('games-discovery-recommended');
    expect(within(shelf).getByText('Recommended for today')).toBeOnTheScreen();
    expect(screen.getByTestId('games-discovery-recommended.attention-evo')).toBeOnTheScreen();
    expect(screen.getByTestId('games-discovery-recommended.speed-sprint')).toBeOnTheScreen();
    expect(screen.queryByTestId('games-discovery-recommended.logic-prime')).toBeNull();

    fireEvent.press(screen.getByTestId('games-discovery-recommended-see-all'));
    expect(await screen.findByTestId('games-discovery-recommended.logic-prime')).toBeOnTheScreen();
    expect(screen.getByTestId('games-discovery-recommended.logic-duo')).toBeOnTheScreen();
  });

  it('recovers from no-results with Clear filters', async () => {
    await renderLibrary();

    await screen.findByTestId('games-grid');
    fireEvent.changeText(screen.getByTestId('games-search'), 'zzz-no-match');

    expect(await screen.findByTestId('games-no-results')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('games-no-results-action'));
    expect(await screen.findByTestId('games-grid')).toBeOnTheScreen();
    expect(await screen.findByText('Showing 6 of 6 games')).toBeOnTheScreen();
  });

  it('renders the empty-catalog state when nothing is registered', async () => {
    registerGameDefinitions([]);
    await renderLibrary();

    expect(await screen.findByTestId('games-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('games-grid')).toBeNull();
  });
});
