/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Missing Operator.
 *
 * After a wrong pick the tapped operator must show the wrong cue (✕ glyph +
 * "Wrong pick" accessible name) AND the true operator must show the correct
 * cue (✓ glyph + "Correct" accessible name) at the same time; the wrong pick
 * must never read as correct. A timeout reveals the correct operator alone.
 * Scores animate through `AnimatedNumber` (`score-live` in session,
 * `score-final` in results).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS, budgetForRound } from '../difficulty';
import { generateEquation } from '../generator';
import MathMissingOperatorScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID, OPERATORS } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PARAMS = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal;

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

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <MathMissingOperatorScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
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

describe('MathMissingOperatorScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a wrong pick marks the wrong operator AND the correct operator together', async () => {
    const seed = 'verdict-cue';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const equation = expectedEquation(seed, 0);
    const wrongOp = OPERATORS.find((op) => op !== equation.answerOperator)!;

    await advanceTime(clock, 2000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'op', wrongOp)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();

    const wrongButton = screen.getByTestId(testId(GAME_ID, 'op', wrongOp));
    const correctButton = screen.getByTestId(testId(GAME_ID, 'op', equation.answerOperator));

    // Wrong cue on the tapped operator …
    expect(within(wrongButton).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(wrongButton.props.accessibilityLabel).toMatch(/Wrong pick/);
    // … correct cue alongside it on the true operator …
    expect(
      within(correctButton).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(correctButton.props.accessibilityLabel).toMatch(/Correct/);
    // … and the wrong pick never reads as correct.
    expect(within(wrongButton).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(wrongButton.props.accessibilityLabel).not.toMatch(/Correct/);
    // Untouched operators stay neutral — no verdict glyph, no verdict name.
    for (const op of OPERATORS) {
      if (op === wrongOp || op === equation.answerOperator) continue;
      const idle = screen.getByTestId(testId(GAME_ID, 'op', op));
      expect(within(idle).queryByText('✓', { includeHiddenElements: true })).toBeNull();
      expect(within(idle).queryByText('✕', { includeHiddenElements: true })).toBeNull();
      expect(idle.props.accessibilityLabel).not.toMatch(/Correct|Wrong pick/);
    }
  });

  it('a timeout reveals the correct operator alone with no wrong cue', async () => {
    const seed = 'verdict-timeout';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const equation = expectedEquation(seed, 0);
    await advanceTime(clock, budgetForRound(PARAMS, 0));

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    const correctButton = screen.getByTestId(testId(GAME_ID, 'op', equation.answerOperator));
    expect(
      within(correctButton).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(correctButton.props.accessibilityLabel).toMatch(/Correct/);
    for (const op of OPERATORS) {
      const button = screen.getByTestId(testId(GAME_ID, 'op', op));
      expect(within(button).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    }
  });

  it('animates the score live in session and in results', async () => {
    const seed = 'verdict-score';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Live count-up readout beside the HUD score, visible while answering.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    const equation = expectedEquation(seed, 0);
    await advanceTime(clock, 2000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'op', equation.answerOperator)));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    // Still mounted behind the verdict so the gain reads as movement.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
    // The plain StatRow score survives next to the animated readout.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toBeOnTheScreen();
  });
});
