/**
 * Game route tutorial injection (frontier audit `persistent-game-tutorials`).
 *
 * The route must hydrate the persisted tutorial row through the database and
 * hand the resulting write-through store to the lazy game screen's
 * `tutorialStore` prop, so production gameplay is backed by SQLite
 * (`tutorial_state`) rather than a process-local map. The mocked loader records
 * the injected prop; the mocked repository records durable writes.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderRouter, waitFor } from 'expo-router/testing-library';

import GameScreen from '@/app/game/[id]';
import type { GameDefinition, TutorialState, TutorialStore, WriteThroughTutorialStore } from '@/sdk';
import { createTutorialLifecycle } from '@/sdk';
import { registerGameDefinitions } from '@/registry/registry';
import { gameScreenLoaders } from '@/registry/registry.generated';

/** Durable rows served by the mocked `getDb().tutorials`. */
const mockTutorialRows = new Map<string, TutorialState>();
/** The `tutorialStore` prop the route injected into the lazy screen. */
let mockInjectedStore: TutorialStore | null = null;

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => ({
      tutorials: {
        getTutorialState: async (gameId: string) => mockTutorialRows.get(gameId) ?? null,
        setTutorialState: async (gameId: string, state: TutorialState) => {
          mockTutorialRows.set(gameId, state);
        },
      },
    }),
  };
});

jest.mock('@/registry/registry.generated', () => ({
  registry: [],
  gameScreenLoaders: {
    memory: async () => ({
      default: function TutorialInjectionProbe({ tutorialStore }: { tutorialStore?: TutorialStore }) {
        mockInjectedStore = tutorialStore ?? null;
        return null;
      },
    }),
  },
}));

const MEMORY_DEFINITION: GameDefinition = {
  id: 'memory',
  name: 'Memory',
  primaryCategory: 'Memory',
  description: 'Probe game',
  sdkVersion: '0.1.0',
  gameVersion: '1.0.0',
  generatorVersion: '1.0.0',
  contentVersion: null,
  hasTutorial: true,
};

async function renderGameRoute() {
  await renderRouter({ 'game/[id]': GameScreen }, { initialUrl: '/game/memory' });
  await waitFor(() => expect(mockInjectedStore).not.toBeNull());
  return mockInjectedStore as WriteThroughTutorialStore;
}

beforeEach(() => {
  mockTutorialRows.clear();
  mockInjectedStore = null;
  // 074: the route resolves a game module through the registry, which
  // validates its runtime surface. Register the mocked loaders with it,
  // otherwise the route has no loader map and cannot resolve the screen.
  registerGameDefinitions([MEMORY_DEFINITION], {
    loaders: gameScreenLoaders as unknown as Record<string, () => Promise<unknown>>,
  });
});

describe('game route tutorial injection', () => {
  it('injects a repository-backed write-through store hydrated from the persisted row', async () => {
    mockTutorialRows.set('memory', { completed: true, replayRequested: false, version: '1.0.0' });

    const store = await renderGameRoute();

    expect(typeof store.flush).toBe('function');
    expect(createTutorialLifecycle(store).shouldShowTutorial('memory')).toBe(false);
  });

  it('persists an in-session completion through the repository (not the in-memory default)', async () => {
    const store = await renderGameRoute();
    const lifecycle = createTutorialLifecycle(store);
    expect(lifecycle.shouldShowTutorial('memory')).toBe(true);

    lifecycle.complete('memory');
    await store.flush();

    expect(mockTutorialRows.get('memory')).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });

  it('keeps help/replay force-show durable across a store re-hydration', async () => {
    const store = await renderGameRoute();
    const lifecycle = createTutorialLifecycle(store);
    lifecycle.complete('memory');
    await store.flush();

    lifecycle.requestReplay('memory');
    await store.flush();

    const persisted = mockTutorialRows.get('memory');
    expect(persisted?.replayRequested).toBe(true);
  });
});
