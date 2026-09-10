// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { CompleteSessionInput } from '@/db';

import CodeCrackerScreen from '../screen';
import { generateSecretCode } from '../generator';
import { GAME_ID } from '../types';
import type { CodeCrackerRawResult } from '../types';
import type { SessionPersistence } from '../session';
import { createInMemoryTutorialStore, createRng, testId } from '@/sdk';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

describe('CodeCrackerScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro screen with difficulty buttons', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'screen'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert'))).toBeTruthy();
  });

  it('selects difficulty and starts a session', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    // Select easy difficulty
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    // Start the session
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Should be in roundReveal phase
    expect(screen.getByTestId(testId(GAME_ID, 'round-reveal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeTruthy();
  });

  it('transitions from roundReveal to input', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Should be in roundReveal
    expect(screen.getByTestId(testId(GAME_ID, 'round-reveal'))).toBeTruthy();
    // Press start guessing
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
    // Should now be in input phase
    expect(screen.getByTestId(testId(GAME_ID, 'input'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'submit-guess'))).toBeTruthy();
  });

  it('allows selecting colors and submitting a guess', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
    // Select 4 colors (normal difficulty has codeLength: 4)
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '1')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '2')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '3')));
    // Submit the guess
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-guess')));
    // Should show guess history
    expect(screen.getByTestId(testId(GAME_ID, 'guess-history'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'history-row', '0'))).toBeTruthy();
  });

  it('shows QA panel in dev mode', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeTruthy();
  });

  it('opens tutorial', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeTruthy();
  });

  it('persists the final adaptive challenge rating in the session record', async () => {
    // Regression: the record difficulty kept the SDK adaptive baseline (0.5)
    // even though the session computed a final challenge rating; the shared
    // rating pipeline reads the record difficulty, so adaptive sessions were
    // rated as neutral.
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }));
    const persister = { completeSession } as unknown as SessionPersistence;
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="adaptive-rating"
        persistSession={persister}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(completeSession).toHaveBeenCalledTimes(1);
    const input = completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as CodeCrackerRawResult;
    const difficulty = input.session.difficulty as { challengeRating: number };
    // Perfect force-win on adaptive: efficiency 1 − 5/50 = 0.9
    // → 0.5 + 0.5 × 0.9 = 0.95.
    expect(raw.challengeRating).toBeCloseTo(0.95);
    expect(difficulty.challengeRating).toBeCloseTo(raw.challengeRating);
  });

  it('persists the resolved round guess history in the raw result', async () => {
    // Regression: the documented per-round guess history was always persisted
    // as an empty array.
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }));
    const persister = { completeSession } as unknown as SessionPersistence;
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="history-seed"
        persistSession={persister}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
    const secret = generateSecretCode({
      rng: createRng('history-seed'),
      roundIndex: 0,
      codeLength: 4,
      colorCount: 6,
      prevSecretCode: null,
    });
    for (const color of secret) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', String(color))));
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-guess')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-solved'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(completeSession).toHaveBeenCalledTimes(1);
    const input = completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as CodeCrackerRawResult;
    expect(raw.guessHistory).toHaveLength(1);
    expect(raw.guessHistory[0]).toHaveLength(1);
    expect(raw.guessHistory[0][0].guess).toEqual(secret);
    expect(raw.guessHistory[0][0].feedback).toEqual({ exact: 4, colorOnly: 0 });
  });
});
