// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CodeCrackerScreen from '../screen';
import { computeFeedback, generateSecretCode } from '../generator';
import { CODE_CRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID } from '../types';
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

const NORMAL = CODE_CRACKER_DIFFICULTY_PARAMS.normal;

/** The round-0 secret the reducer must generate for `seed` on normal. */
function secretFor(seed: string): number[] {
  return [
    ...generateSecretCode({
      rng: createRng(seed),
      roundIndex: 0,
      codeLength: NORMAL.codeLength,
      colorCount: NORMAL.colorCount,
      prevSecretCode: null,
    }),
  ];
}

async function startInput(seed: string) {
  await render(<CodeCrackerScreen tutorialStore={completedStore()} sessionSeed={seed} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
}

async function submitGuess(guess: readonly number[]) {
  for (const color of guess) {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', String(color))));
  }
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-guess')));
}

describe('CodeCrackerScreen verdict language', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('solving a round shows the success verdict panel with the revealed code', async () => {
    const seed = 'verdict-solve';
    const secret = secretFor(seed);
    await startInput(seed);

    await submitGuess(secret);

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeTruthy();
    // Multi-channel verdict: headline + glyph badge together. The badge is
    // decorative (hidden from the a11y tree); the words channel is asserted
    // through the headline and labels.
    expect(screen.getByTestId(testId(GAME_ID, 'round-solved'))).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✓');
    // The stem (secret code) stays mounted inside the verdict.
    expect(screen.getByTestId(testId(GAME_ID, 'secret-reveal'))).toBeTruthy();
    for (let i = 0; i < NORMAL.codeLength; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'secret-peg', String(i)))).toBeTruthy();
    }
  });

  it('exhausting the budget shows the failure verdict panel', async () => {
    const seed = 'verdict-fail';
    const secret = secretFor(seed);
    // Every position differs, so this guess can never solve the round.
    const wrong = secret.map((c) => (c + 1) % NORMAL.colorCount);
    await startInput(seed);

    for (let i = 0; i < NORMAL.guessBudget; i += 1) {
      await submitGuess(wrong);
    }

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✕');
    expect(screen.getByTestId(testId(GAME_ID, 'secret-reveal'))).toBeTruthy();
  });

  it('shows the animated live score while the session runs', async () => {
    await startInput('verdict-score');
    const live = screen.getByTestId(testId(GAME_ID, 'score-live'));
    expect(live).toBeTruthy();
    expect(live).toHaveTextContent('0');
  });

  it('summarises guess feedback as text for assistive tech', async () => {
    const seed = 'verdict-feedback';
    const secret = secretFor(seed);
    const wrong = secret.map((c) => (c + 1) % NORMAL.colorCount);
    const feedback = computeFeedback(secret, wrong);
    await startInput(seed);

    await submitGuess(wrong);

    expect(
      screen.getByLabelText(`${feedback.exact} exact, ${feedback.colorOnly} color only`),
    ).toBeTruthy();
  });

  it('gives pegs a real 44 dp interaction area without hit slop', async () => {
    const seed = 'verdict-touch';
    await startInput(seed);

    // Picker swatches: 48 dp circles; guess slots: 44 dp pegs.
    expect(screen.getByTestId(testId(GAME_ID, 'color', '0'))).toHaveStyle({
      width: 48,
      height: 48,
    });
    expect(screen.getByTestId(testId(GAME_ID, 'guess-peg', '0'))).toHaveStyle({
      width: 44,
      height: 44,
    });

    await submitGuess(secretFor(seed));
    expect(screen.getByTestId(testId(GAME_ID, 'secret-peg', '0'))).toHaveStyle({
      width: 44,
      height: 44,
    });
  });
});
