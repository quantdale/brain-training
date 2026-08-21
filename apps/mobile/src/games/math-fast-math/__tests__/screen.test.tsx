/**
 * MathScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → problem → feedback → rounds → results →
 * persistence. Budget timeout, pause-freeze semantics and the dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_PARAMS, TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { MATH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSessionProblems } from '../generator';
import MathScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { MathRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = MATH_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = 8_000;
/** Time spent answering each problem in the full-session test. */
const ANSWER_MS = 1_000;

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
    <MathScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
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

/** Press the number-pad digits of an answer, then submit. */
async function typeAnswer(answer: number) {
  for (const digit of String(answer)) {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'digit', digit)));
  }
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
}

describe('MathScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'problem', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'problem-text'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'number-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'problem-label', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateSessionProblems(createRng(TUTORIAL_DEMO_SEED), TUTORIAL_DEMO_PARAMS);

    // A wrong answer shows the retry status and clears the input.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'digit', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      'Not quite — try again.',
    );

    await typeAnswer(demo[0].answer);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      'Solve 1 more problem.',
    );
    await typeAnswer(demo[1].answer);

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<MathScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
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
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'problem', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'timer'))).toBeOnTheScreen();

    // normal: 5 problems generated deterministically from the seed.
    const problems = generateSessionProblems(createRng(seed), NORMAL);
    expect(problems).toHaveLength(5);
    for (let index = 0; index < problems.length; index += 1) {
      // Answer within the budget (ticker also advances the elapsed display).
      await advanceTime(clock, ANSWER_MS);
      await typeAnswer(problems[index].answer);
      expect(screen.getByTestId(testId(GAME_ID, 'feedback-correct'))).toBeOnTheScreen();

      if (index < problems.length - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
        expect(screen.getByTestId(testId(GAME_ID, 'problem', String(index + 2)))).toBeOnTheScreen();
      }
    }

    // Final problem: the feedback button leads to the results screen.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'problems-correct'))).toHaveTextContent('5/5');
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
      String(5 * (100 + Math.round(50 * (1 - ANSWER_MS / BUDGET_MS)))),
    ); // 5 × 144

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('math-fast-math');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(problems.length * ANSWER_MS); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    // accuracy 1 × (0.5 + 0.5 × (1 − 1000/8000)) = 0.9375
    expect(input.session.normalizedResult).toBeCloseTo(0.9375);
    const raw = input.session.rawResult as MathRawResult;
    expect(raw.score).toBe(720); // 5 × (100 + 44)
    expect(raw.avgCorrectMs).toBe(1_000);
    // 1.1.0: campaign-010 W23 content wave (expert two-step tier); scoring
    // semantics unchanged, so the rest of this suite still pins the old math.
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.1.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('scores a wrong answer as a failure and continues', async () => {
    const seed = 'wrong-answer';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // '0' is never a valid answer (answers are ≥ 1 by construction).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'digit', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-incorrect'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-expected-answer'))).toBeOnTheScreen();

    const problems = generateSessionProblems(createRng(seed), NORMAL);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
    expect(screen.getByTestId(testId(GAME_ID, 'problem', '2'))).toBeOnTheScreen();

    // Answer the remaining four correctly.
    for (let index = 1; index < problems.length; index += 1) {
      await typeAnswer(problems[index].answer);
      if (index < problems.length - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
      }
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'problems-correct'))).toHaveTextContent('4/5');
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('80%');

    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as MathRawResult).problemsCorrect).toBe(4);
  });

  it('times out via the ticker at the budget boundary', async () => {
    const { clock } = await renderScreen({ seed: 'timeout-tick' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, BUDGET_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-expected-answer'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-problem')));
    expect(screen.getByTestId(testId(GAME_ID, 'problem', '2'))).toBeOnTheScreen();
  });

  it('scores a submit past the budget as a timeout even before the next tick', async () => {
    const { clock } = await renderScreen({ seed: 'timeout-race' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Advance the lifecycle clock WITHOUT firing the ticker.
    await act(async () => {
      clock.advance(BUDGET_MS);
    });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'digit', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and the budget freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1_000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('math-fast-math.pause-overlay')).toBeOnTheScreen();

    // Frozen: elapsed background time must not consume the budget.
    await advanceTime(clock, 5_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeNull();

    // The full remaining budget is still required (7000ms after 1000ms used).
    await advanceTime(clock, 6_999);
    expect(screen.queryByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'problem', '1'))).toBeOnTheScreen();
    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeOnTheScreen();
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
    expect((input.session.rawResult as MathRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'problems-correct'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as MathRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
