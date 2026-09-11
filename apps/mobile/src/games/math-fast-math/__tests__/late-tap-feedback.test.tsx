/**
 * Late-submit feedback regression (Campaign 023 KNOWN_ISSUES → 024 micro R2).
 *
 * Submit feedback used to fire from the submit handler's optimism (entered
 * digits matched the answer) BEFORE the reducer's budget guard resolved, so
 * a correct-looking submit landing inside the scheduling gap — past the
 * budget, before the next ticker tick — sounded "correct" while the problem
 * scored a timeout. Feedback now derives from the reducer's authoritative
 * resolution.
 *
 * The "stays silent" test fails on the old behaviour: the old handler played
 * the correct sound unconditionally for a matching answer, while the timeout
 * resolution (unchanged scoring) still holds.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  liveAudioHaptics,
  testId,
} from '@/sdk';
import type { FakeClock } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { MATH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSessionProblems } from '../generator';
import MathScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = MATH_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = 8_000;

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

async function renderScreen(options: { seed?: string; clock?: FakeClock } = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const result = await render(
    <MathScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={options.seed ?? 'late-tap-seed'}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** Advance both the fake lifecycle clock and the budget ticker. */
async function advanceTime(clock: FakeClock, ms: number) {
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

describe('MathScreen late-submit feedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a correct-looking submit past the budget stays silent while the problem times out', async () => {
    const seed = 'late-submit-silent';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // The CORRECT answer: the old handler sounded success for exactly this
    // input, while the reducer scores it a timeout.
    const answer = generateSessionProblems(createRng(seed), NORMAL)[0].answer;

    // Advance the lifecycle clock to the budget WITHOUT firing the ticker:
    // this is the scheduling gap (the submit lands past the budget, before
    // the next tick resolves the timeout).
    await act(async () => {
      clock.advance(BUDGET_MS);
    });

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    const haptic = jest.spyOn(liveAudioHaptics, 'haptic');
    for (const digit of String(answer)) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'digit', digit)));
    }
    playSfx.mockClear();
    haptic.mockClear();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

    // The reducer resolved the submit as a timeout, so no correct/wrong
    // feedback may fire. Fails on old behaviour.
    expect(playSfx).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-expected-answer'))).toBeOnTheScreen();
  });

  it('an in-budget correct submit still sounds correct', async () => {
    const seed = 'late-submit-control';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const answer = generateSessionProblems(createRng(seed), NORMAL)[0].answer;

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    await advanceTime(clock, 1_000);
    playSfx.mockClear();
    await typeAnswer(answer);

    // Authoritative outcome is correct, so the correct feedback still fires.
    expect(playSfx).toHaveBeenCalledWith('math-fast-math-correct');
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-correct'))).toBeOnTheScreen();
  });
});
