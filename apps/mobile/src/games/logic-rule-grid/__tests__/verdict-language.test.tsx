// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionResult, GameSessionRecord } from '@/db';
import RuleGridScreen from '../screen';
import { GAME_ID } from '../types';
import { generateRound } from '../generator';
import { resolveRuleGridDifficulty, ruleGridParamsFromProfile } from '../difficulty';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** Deterministically compute round 0 for the standard test seed. */
function round0Answer(seed = 'test-seed') {
  const profile = resolveRuleGridDifficulty('normal');
  const params = ruleGridParamsFromProfile(profile);
  return generateRound({ rng: createRng(seed), roundIndex: 0, params, prevRound: null });
}

function resultsPersister(): SessionPersistence {
  return {
    completeSession: jest.fn(async (): Promise<CompleteSessionResult> => ({
      session: {} as GameSessionRecord,
      ledgerEntry: null,
      balance: 0,
      rating: null,
      completionOutcome: null,
    })),
  } as unknown as SessionPersistence;
}

describe('RuleGridScreen verdict language', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the true symbol correct on the result board (fill + glyph + words)', async () => {
    const round = round0Answer();
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(round.answer))));

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✓');
    // The verdict is in the accessible name, not colour alone.
    expect(screen.getByLabelText(`Correct: ${round.answer + 1}`)).toBeTruthy();
    // The stem (prompt, grid, answer reveal) stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-prompt'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'cell', String(round.blankIndex)))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'correct-symbol'))).toBeTruthy();
  });

  it('marks the wrong pick alongside the correct symbol on a miss', async () => {
    const round = round0Answer();
    const wrong = round.options.find((o) => o !== round.answer) ?? (round.answer + 1) % round.size;
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(wrong))));

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✕');
    expect(screen.getByLabelText(`Wrong pick: ${wrong + 1}`)).toBeTruthy();
    expect(screen.getByLabelText(`Correct: ${round.answer + 1}`)).toBeTruthy();
    // Untouched candidates stay mounted under the same selectors, now locked.
    for (const value of round.options) {
      expect(screen.getByTestId(testId(GAME_ID, 'symbol-option', String(value)))).toBeTruthy();
    }
  });

  it('shows the animated live score while the session runs', async () => {
    await render(<RuleGridScreen tutorialStore={completedStore()} sessionSeed="test-seed" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const live = screen.getByTestId(testId(GAME_ID, 'score-live'));
    expect(live).toBeTruthy();
    expect(live).toHaveTextContent('0');
  });

  it('shows the animated final score on the results screen', async () => {
    await render(
      <RuleGridScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
        persistSession={resultsPersister()}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeTruthy();
  });
});
