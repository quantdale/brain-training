/**
 * Color-stroop verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * The verdict must never reuse the stimulus hues: feedback carries the
 * verdict through a soft fill + verdict border + ✓/✕/⏱ badge, while the
 * stimulus (the stem) stays mounted beside the verdict panel.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { colorStroopParamsForLevel } from '../difficulty';
import { generateTrials } from '../generator';
import ColorStroopScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID, STROOP_COLORS } from '../types';
import type { StroopColor } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

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

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  await render(
    <ColorStroopScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={seed}
      persistSession={persister}
    />,
  );
  return { clock, store, persister };
}

/** Deterministic first trial for the default (normal) difficulty. */
function firstTrial(seed: string) {
  return generateTrials({ rng: createRng(seed), params: colorStroopParamsForLevel('normal') })[0];
}

async function startTrial(seed: string) {
  await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
  return firstTrial(seed);
}

async function answer(color: StroopColor) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, `answer-buttons-${color}`)));
}

describe('ColorStroopScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the stimulus visible beside a wrong-answer verdict and names the correct answer', async () => {
    const trial = await startTrial('verdict-wrong');
    const wrong = STROOP_COLORS.find((color) => color !== trial.correctAnswer) ?? 'red';

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await answer(wrong);

    const feedback = screen.getByTestId(testId(GAME_ID, 'feedback'));
    expect(feedback).toBeOnTheScreen();
    expect(feedback).toHaveTextContent(/Wrong!/);
    expect(feedback).toHaveTextContent(new RegExp(`It was ${trial.correctAnswer}`));
    // The stem stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
    // The rule cue stays visible through feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'rule'))).toBeOnTheScreen();
  });

  it('shows the correct verdict beside the stimulus', async () => {
    const trial = await startTrial('verdict-correct');

    await answer(trial.correctAnswer);

    const feedback = screen.getByTestId(testId(GAME_ID, 'feedback'));
    expect(feedback).toHaveTextContent(/Correct!/);
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
  });

  it('shows the timeout verdict beside the stimulus and still names the answer', async () => {
    const trial = await startTrial('verdict-timeout');

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    const feedback = screen.getByTestId(testId(GAME_ID, 'feedback'));
    expect(feedback).toHaveTextContent(/Time's up!/);
    expect(feedback).toHaveTextContent(new RegExp(`It was ${trial.correctAnswer}`));
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
  });
});
