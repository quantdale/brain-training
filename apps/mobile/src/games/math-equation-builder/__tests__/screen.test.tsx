/**
 * MathEquationBuilderScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the game loop with
 * fake timers: intro → tutorial → playing → rounds → results → persistence.
 * Pause freeze semantics and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import MathEquationBuilderScreen from '../screen';
import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generatePuzzle } from '../generator';
import { evaluateEquation } from '../evaluator';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { MathEquationBuilderRawResult, Operator } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

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
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
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
    <MathEquationBuilderScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the reveal timers. */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('MathEquationBuilderScreen', () => {
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

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'number-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'operator-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'target'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ seed: 'tut', store });

    // The tutorial auto-opens at the intro step.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();

    // Advance intro → demo. Reproduce the deterministic demo puzzle from the
    // fixed seed and solve it with the shared evaluator so we can drive the
    // exact taps the component expects (3 numbers, 2 operators, left-to-right).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const puzzle = generatePuzzle({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      params: {
        numbersCount: 3,
        targetMin: 10,
        targetMax: 30,
        operators: ['+', '-'],
        rounds: 1,
        timeBudgetMs: 60_000, // unused in the tutorial; mirrors the component
      },
      prevTarget: null,
    });

    // Brute-force a valid ordering of the three numbers and the two operator
    // slots, matching the evaluator's left-to-right semantics.
    const indices = [0, 1, 2];
    let order: number[] | null = null;
    let ops: Operator[] | null = null;
    outer: for (const a of indices) {
      for (const b of indices) {
        if (b === a) continue;
        for (const c of indices) {
          if (c === a || c === b) continue;
          for (const o1 of puzzle.operators) {
            for (const o2 of puzzle.operators) {
              const candidate: (Operator | number)[] = [
                puzzle.numbers[a],
                o1,
                puzzle.numbers[b],
                o2,
                puzzle.numbers[c],
              ];
              if (evaluateEquation(candidate) === puzzle.target) {
                order = [a, b, c];
                ops = [o1, o2];
                break outer;
              }
            }
          }
        }
      }
    }
    expect(order).not.toBeNull();
    expect(ops).not.toBeNull();

    const [n0, n1, n2] = order as number[];
    const [o0, o1] = ops as Operator[];
    for (const [i, n] of [n0, n1, n2].entries()) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number', String(n))));
      if (i < 2) {
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, 'operator', i === 0 ? o0 : o1)),
        );
      }
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-submit')));

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full session end-to-end with force-win and persists the record', async () => {
    const seed = 'screen-e2e';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'number-pad'))).toBeOnTheScreen();

    // Use QA force-win to end the session.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('math-equation-builder');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBe(1); // perfect forced run
    const raw = input.session.rawResult as MathEquationBuilderRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.score).toBe(1500); // 5 rounds × 300
    expect(raw.difficulty).toBe('normal');
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'number-pad'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();

    // Frozen: advance a lot of time, then resume — timer should still show a large value.
    await advanceTime(clock, 30_000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'pause-overlay'))).toBeNull();

    // The timer should still be close to the original budget (not decremented during pause).
    const timer = screen.getByTestId(testId(GAME_ID, 'timer'));
    const timerText = String(timer.props.children);
    // Timer should show >40s (budget was 50s, only a second or so elapsed before pause).
    const seconds = parseInt(timerText.replace(/[^0-9]/g, ''), 10);
    expect(seconds).toBeGreaterThan(40);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as MathEquationBuilderRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
