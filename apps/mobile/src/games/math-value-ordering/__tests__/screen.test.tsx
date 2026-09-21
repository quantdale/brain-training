/**
 * ValueOrderingScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the game loop:
 * intro → ordering → feedback → next round → results → persistence. The
 * dev-only QA force-win path and restart/quit navigation are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { VALUE_ORDERING_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound, sortedValuesOf } from '../generator';
import ValueOrderingScreen from '../screen';
import { perfectSessionScore } from '../scoring';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { ValueOrderingRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();

const NORMAL = VALUE_ORDERING_DIFFICULTY_PARAMS.normal;

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(outcome: { xp: number; currency: number } | null = null) {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: outcome?.currency ?? 0,
    rating: null,
    completionOutcome:
      outcome === null
        ? null
        : {
            session: input.session,
            xp: outcome.xp,
            currency: outcome.currency,
            deltas: [],
            balance: outcome.currency,
          },
  }));
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(
  options: {
    seed?: string;
    store?: ReturnType<typeof createInMemoryTutorialStore>;
    clock?: ReturnType<typeof createFakeClock>;
    persister?: ReturnType<typeof makePersister>;
  } = {},
) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <ValueOrderingScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Ascending-value tiles of a round, computed from the same seeded generator. */
function ascendingTiles(seed: string, roundIndex: number, prevValues: number[] | null) {
  const round = generateRound(createRng(seed), roundIndex, NORMAL, NORMAL.tiles, prevValues);
  return [...round.tiles].sort((a, b) => a.value - b.value);
}

async function tapTile(value: number) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(value))));
}

async function pressToggleAndForce(action: 'force-win' | 'force-lose') {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, action)));
}

describe('ValueOrderingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterBack.mockClear();
    mockRouterReplace.mockClear();
    (useRouter as unknown as jest.Mock).mockReturnValue({
      back: mockRouterBack,
      replace: mockRouterReplace,
      navigate: jest.fn(),
      // Pushed-route path: the stack can go back, so `useSafeBack` must stay
      // byte-identical to the old bare `router.back()`.
      canGoBack: () => true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro and Start opens an ordering session', async () => {
    await renderScreen({ seed: 'intro' });

    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'help'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'value-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-time'))).toHaveTextContent(
      new RegExp(`${NORMAL.tiles} to go`),
    );
  });

  it('locks taps in ascending order, resolves a perfect round, and advances', async () => {
    const seed = 'screen-play';
    await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const round0 = ascendingTiles(seed, 0, null);
    expect(round0).toHaveLength(NORMAL.tiles);

    // First correct tap is observable: rank badge + shrinking remaining count.
    await tapTile(round0[0].value);
    expect(screen.getByTestId(testId(GAME_ID, 'tile-rank', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-time'))).toHaveTextContent(
      new RegExp(`${NORMAL.tiles - 1} to go`),
    );

    // Finish the round in ascending order: the verdict frame replaces the grid
    // with rank badges and the correct-order reveal.
    for (const tile of round0.slice(1)) {
      await tapTile(tile.value);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-perfect'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
      `Correct order: ${round0.map((tile) => tile.display).join('  <  ')}`,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();

    // A wrong (non-minimum) tap resolves round 2 as a mistake with its verdict.
    const prevValues = sortedValuesOf(
      generateRound(createRng(seed), 0, NORMAL, NORMAL.tiles, null),
    );
    const round1 = ascendingTiles(seed, 1, prevValues);
    await tapTile(round1[1].value);
    expect(screen.getByTestId(testId(GAME_ID, 'round-mistake'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'submitted-order'))).toHaveTextContent(
      `Your order: ${round1[1].display}`,
    );
  });

  it('force-win reaches results with the forced badge and one persisted record', async () => {
    const seed = 'qa-win';
    const persister = makePersister({ xp: 42, currency: 7 });
    await renderScreen({ seed, persister });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-win');

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'hits'))).toHaveTextContent(
      `${NORMAL.rounds}/${NORMAL.rounds}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toHaveTextContent(
      String(perfectSessionScore(NORMAL)),
    );

    // Flush the async persistence chain; the authoritative reward lands after it.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as ValueOrderingRawResult;
    expect(input.session.gameId).toBe(GAME_ID);
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(Number.isFinite(input.session.normalizedResult)).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
    expect(raw.forced).toBe(true);
    expect(raw.seed).toBe(seed);
    expect(raw.roundsHit).toBe(NORMAL.rounds);
    expect(screen.getByTestId(testId(GAME_ID, 'xp'))).toHaveTextContent('42');
  });

  it('restarts a fresh session from results and quits back to the library', async () => {
    const { persister, result } = await renderScreen({ seed: 'restart' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-win');
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();

    await pressToggleAndForce('force-win');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'quit')));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    await result.unmount();
  });
});
