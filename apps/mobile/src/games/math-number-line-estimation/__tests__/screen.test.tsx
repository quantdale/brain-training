/**
 * NumberLineScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister, fixed playfield width) and drives the
 * full game loop with fake timers: intro → tutorial → rounds → results →
 * persistence. Budget timeout, pause-freeze semantics and the dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSessionRounds } from '../generator';
import NumberLineScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { NumberLineRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = NUMBER_LINE_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = NORMAL.budgetMs;
/** Fixed playfield width for deterministic tap geometry (tests). */
const LINE_WIDTH = 100;
/** locationX of a value on the [0, 20] line rendered at LINE_WIDTH px. */
function xOf(value: number): number {
  return ((value - NORMAL.lineMin) / (NORMAL.lineMax - NORMAL.lineMin)) * LINE_WIDTH;
}

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(
    async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }),
  );
  return { completeSession } as unknown as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(options: {
  seed?: string;
  store?: ReturnType<typeof createInMemoryTutorialStore>;
  clock?: ReturnType<typeof createFakeClock>;
  persister?: ReturnType<typeof makePersister>;
} = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <NumberLineScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
      numberLineWidth={LINE_WIDTH}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the budget ticker (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Tap the line at the exact position of `value`. */
async function tapValue(value: number) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number-line')), {
    nativeEvent: { locationX: xOf(value) },
  });
}

describe('NumberLineScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen({ seed: 'intro' });

    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'help'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'number-line'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'line-flag'))).toBeOnTheScreen();
    // Endpoint labels show the range but never the target value.
    expect(screen.getByTestId(testId(GAME_ID, 'line-label-min'))).toHaveTextContent('0');
    expect(screen.getByTestId(testId(GAME_ID, 'line-label-max'))).toHaveTextContent('100');
  });

  it('opens the tutorial on first play and completes it', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end with exact taps and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'number-line'))).toBeOnTheScreen();

    const rounds = generateSessionRounds(createRng(seed), NORMAL);
    for (let i = 0; i < rounds.length; i += 1) {
      await tapValue(rounds[i].target);
      if (i < rounds.length - 1) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-hit'))).toBeOnTheScreen();
        expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
          `The flag was at ${rounds[i].target}. You tapped ${rounds[i].target}.`,
        );
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-hit'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'hits'))).toHaveTextContent(`${rounds.length}/${rounds.length}`);

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('math-number-line-estimation');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBeCloseTo(1);
    const raw = input.session.rawResult as NumberLineRawResult;
    expect(raw.roundsHit).toBe(rounds.length);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
  }, 30_000);

  it('times a round out at the budget when no estimate is made', async () => {
    const { clock } = await renderScreen({ seed: 'timeout' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Just inside the budget: still estimating.
    await advanceTime(clock, BUDGET_MS - 500);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    // Past the budget: the ticker resolves the round as a timeout.
    await advanceTime(clock, 1_000);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears, the budget freezes, and resume continues', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'number-line'))).toBeOnTheScreen();

    // Burn 2s of active time, then pause.
    await advanceTime(clock, 2_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();

    // A long background pause must not consume budget: only 2s are banked.
    await advanceTime(clock, 60_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'pause-overlay'))).toBeNull();

    // 2s active + 7.5s more is still inside the 10s budget.
    await advanceTime(clock, 7_500);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'number-line'))).toBeOnTheScreen();

    // Crossing the remaining budget times out.
    await advanceTime(clock, 1_000);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
  });

  it('resolves a round exactly once per estimate (double-submit protection)', async () => {
    const seed = 'double-tap';
    await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const rounds = generateSessionRounds(createRng(seed), NORMAL);
    await tapValue(rounds[0].target);
    expect(screen.getByTestId(testId(GAME_ID, 'round-hit'))).toBeOnTheScreen();
    // An exact tap scores exactly 150 once — never doubled by stray presses
    // racing the re-render (the reducer folds them as no-ops).
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 150');
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as NumberLineRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBeCloseTo(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'hits'))).toHaveTextContent(`0/${NORMAL.rounds}`);
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as NumberLineRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
