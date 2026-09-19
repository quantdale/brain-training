/**
 * Verdict-cue contract (PATTERNS-PLAY 6, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong submission must differ from a correct one by fill AND icon on the
 * equation display, must never read as correct, and must reveal the correct
 * equation (the mechanic's solution reveal) while the stem stays visible.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import type { FakeClock } from '@/sdk';

import MathEquationBuilderScreen from '../screen';
import { EquationDisplay } from '../components/equation-display';
import { GAME_ID } from '../types';
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

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
  }));
  return { completeSession } as SessionPersistence & {
    completeSession: jest.Mock;
  };
}

describe('MathEquationBuilderScreen verdict cue', () => {
  let clock: FakeClock;
  beforeEach(() => {
    jest.useFakeTimers();
    clock = createFakeClock(0);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks a wrong submission with the wrong cue, never the correct cue', async () => {
    await render(
      <MathEquationBuilderScreen
        clock={clock}
        tutorialStore={completedStore()}
        sessionSeed="verdict-cue"
        persistSession={makePersister()}
      />,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'number-pad'))).toBeOnTheScreen();

    // Build a complete equation (number (op number)*) with the first
    // operator; the fixed seed makes the outcome deterministic (wrong).
    const numbers = screen.getAllByTestId(/math-equation-builder\.number\.\d+/);
    const operators = screen.getAllByTestId(/math-equation-builder\.operator\..+/);
    expect(numbers.length).toBeGreaterThan(1);
    expect(operators.length).toBeGreaterThan(0);
    for (let i = 0; i < numbers.length; i += 1) {
      await fireEvent.press(numbers[i]);
      if (i < numbers.length - 1) {
        await fireEvent.press(operators[0]);
      }
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    const verdict = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(verdict.props.accessibilityLabel).toMatch(/Wrong answer/);
    expect(within(verdict).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(verdict).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText('✓ Correct!')).toBeNull();
    expect(screen.queryByLabelText(/Correct:/)).toBeNull();

    // The mechanic reveals the correct equation; the stem stays visible.
    expect(screen.getByTestId(testId(GAME_ID, 'solution-reveal'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'equation'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'target'))).toBeOnTheScreen();

    // The live score readout is visible during the session.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
  });

  it('differs the correct display from the wrong display by fill and icon', async () => {
    const correctTree = await render(
      <EquationDisplay target={10} tokens={[4, '+', 6]} result={10} isCorrect />,
    );
    const correctPanel = correctTree.getByTestId(testId(GAME_ID, 'equation-display'));
    const correctVerdict = correctTree.getByTestId(testId(GAME_ID, 'verdict'));
    // Capture the fill before unmount; assert icon + label while mounted.
    const correctFill = StyleSheet.flatten(correctPanel.props.style).backgroundColor;
    expect(
      within(correctVerdict).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(correctVerdict).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    expect(String(correctVerdict.props.accessibilityLabel)).toMatch(/Correct:/);
    await correctTree.unmount();

    const wrongTree = await render(
      <EquationDisplay target={10} tokens={[4, '+', 5]} result={9} isCorrect={false} />,
    );
    const wrongPanel = wrongTree.getByTestId(testId(GAME_ID, 'equation-display'));
    const wrongVerdict = wrongTree.getByTestId(testId(GAME_ID, 'verdict'));
    const wrongFill = StyleSheet.flatten(wrongPanel.props.style).backgroundColor;
    expect(
      within(wrongVerdict).getByText('✕', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(wrongVerdict).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(String(wrongVerdict.props.accessibilityLabel)).toMatch(/Wrong answer/);
    await wrongTree.unmount();

    // Fill channel: verdict panels use distinct fills.
    expect(correctFill).not.toBe(wrongFill);
  });
});
