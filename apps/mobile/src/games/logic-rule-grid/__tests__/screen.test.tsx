// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRng, testId } from '@/sdk';

import RuleGridScreen from '../screen';
import { GAME_ID } from '../types';
import { generateRound } from '../generator';
import { resolveRuleGridDifficulty, ruleGridParamsFromProfile } from '../difficulty';
import type { CompleteSessionResult, GameSessionRecord } from '@/db';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const sdk = require('@/sdk');
  const store = sdk.createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** Deterministically compute round 0's answer for the standard test seed. */
function round0Answer(seed = 'test-seed', level: 'easy' | 'normal' = 'normal') {
  const profile = resolveRuleGridDifficulty(level);
  const params = ruleGridParamsFromProfile(profile);
  const round = generateRound({ rng: createRng(seed), roundIndex: 0, params, prevRound: null });
  return round;
}

describe('RuleGridScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro screen with difficulty buttons', async () => {
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    expect(screen.getByTestId(testId(GAME_ID, 'screen'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert'))).toBeTruthy();
  });

  it('selects difficulty and starts a session', async () => {
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeTruthy();
  });

  it('shows the grid and symbol options in showGrid', async () => {
    const round = round0Answer();
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-prompt'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'symbol-options'))).toBeTruthy();
    // Every option button is rendered.
    for (const value of round.options) {
      expect(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(value)))).toBeTruthy();
    }
    // The blank cell is rendered as a placeholder (testID present).
    expect(screen.getByTestId(testId(GAME_ID, 'cell', String(round.blankIndex)))).toBeTruthy();
  });

  it('pressing the correct symbol moves to a correct round result', async () => {
    const round = round0Answer();
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(round.answer))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'correct-symbol'))).toBeTruthy();
  });

  it('pressing a wrong symbol moves to a wrong round result', async () => {
    const round = round0Answer();
    const wrong = round.options.find((o) => o !== round.answer) ?? (round.answer + 1) % round.size;
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(wrong))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeTruthy();
  });

  it('opens the tutorial from the intro help button', async () => {
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeTruthy();
  });

  it('shows the QA panel in dev mode', async () => {
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeTruthy();
  });

  it('completes a session and shows the results screen with accuracy', async () => {
    const persistSession: SessionPersistence = {
      completeSession: jest.fn(async (): Promise<CompleteSessionResult> => ({
        session: {} as GameSessionRecord,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      })),
    };
    await render(
      <RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" persistSession={persistSession} />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Open the dev QA panel and force a win (lands on results).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toBeTruthy();
    expect(persistSession.completeSession).toHaveBeenCalledTimes(1);
  });
});
