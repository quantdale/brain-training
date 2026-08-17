/**
 * MathMissingOperatorScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with fake
 * timers: intro → tutorial → answer rounds (correct/wrong/timeout) → results
 * → persistence. Pause freeze semantics and the dev-only QA force paths are
 * covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS, budgetForRound } from '../difficulty';
import { generateEquation } from '../generator';
import MathMissingOperatorScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID, OPERATORS, OPERATOR_GLYPHS } from '../types';
import type { MathMissingOperatorRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PARAMS = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal;

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false });
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
    <MathMissingOperatorScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the round timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** The equation the reducer generates for a normal session round. */
function expectedEquation(seed: string, roundIndex: number) {
  return generateEquation({
    rng: createRng(seed),
    roundIndex,
    params: PARAMS,
    level: 'normal',
  });
}

describe('MathMissingOperatorScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'answer-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    for (const op of OPERATORS) {
      expect(screen.getByTestId(testId(GAME_ID, 'op', op))).toBeOnTheScreen();
    }
    expect(screen.getByTestId(testId(GAME_ID, 'equation'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'operator-slot'))).toHaveTextContent('?');
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateEquation({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      params: MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.easy,
      level: 'easy',
    });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-op', demo.answerOperator)));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <MathMissingOperatorScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-full';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-status'))).toBeOnTheScreen();

    // normal: 7 rounds; answer each at exactly 2000ms.
    let expectedScore = 0;
    for (let round = 0; round < PARAMS.rounds; round += 1) {
      const equation = expectedEquation(seed, round);
      const budget = budgetForRound(PARAMS, round);

      await advanceTime(clock, 2000);
      expect(screen.getByTestId(testId(GAME_ID, 'equation'))).toHaveTextContent(
        `${equation.a}?${equation.b}=${equation.c}`,
      );

      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'op', equation.answerOperator)));
      expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
      // Mirror the scoring formula for the wiring assertion (unit-tested in
      // scoring.test.ts).
      expectedScore +=
        100 + Math.round(50 * (1 - Math.min(1, Math.max(0, 2000 / budget))));

      if (round < PARAMS.rounds - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
        expect(screen.getByTestId(testId(GAME_ID, 'round', String(round + 2)))).toBeOnTheScreen();
      }
    }

    // Final round: the result card's button leads to the results screen.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent('7/7');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(String(expectedScore));
    expect(screen.getByTestId(testId(GAME_ID, 'avg-response'))).toHaveTextContent('2.0 s');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('math-missing-operator');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(7 * 2000); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    // avg response 2000 of a 10000 base → speed 0.8 → value 0.92.
    expect(input.session.normalizedResult).toBeCloseTo(0.92, 4);
    const raw = input.session.rawResult as MathMissingOperatorRawResult;
    expect(raw.score).toBe(expectedScore);
    expect(raw.accuracy).toBe(1);
    expect(raw.timeouts).toBe(0);
    expect(raw.bestStreak).toBe(7);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong pick, reveals the answer, and continues', async () => {
    const seed = 'wrong-pick';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const equation = expectedEquation(seed, 0);
    const wrongOp = OPERATORS.find((op) => op !== equation.answerOperator)!;

    await advanceTime(clock, 2000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'op', wrongOp)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-correct'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The revealed slot shows the correct operator.
    expect(screen.getByTestId(testId(GAME_ID, 'operator-slot'))).toHaveTextContent(
      OPERATOR_GLYPHS[equation.answerOperator],
    );

    // The next round still advances the round counter.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('times out a round when the budget expires without an answer', async () => {
    const seed = 'timeout';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, budgetForRound(PARAMS, 0));

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-correct'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and the round timer freezes until resume', async () => {
    const seed = 'pause-test';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();

    // Frozen: elapsed background time must not advance the round timer.
    await advanceTime(clock, 5000);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    // Remaining budget is budget(round 0) − 1000 = 9000 (the paused 5000ms
    // did not count).
    const remaining = budgetForRound(PARAMS, 0) - 1000;
    await advanceTime(clock, remaining - 1);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent('7/7');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as MathMissingOperatorRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as MathMissingOperatorRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
