/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Number Line Estimation.
 *
 * When a round resolves, the correct position (flag) must stay visible next
 * to the player's guess marker, and the verdict must read by fill + shape +
 * glyph + words: the guess disc carries ✓/✕ while the line's accessible name
 * carries the verdict ("Correct" / "Too far off" / "Timed out"). A timeout
 * shows the flag alone. Scores animate through `AnimatedNumber`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSessionRounds } from '../generator';
import NumberLineScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = NUMBER_LINE_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = NORMAL.budgetMs;
/** Fixed playfield width for deterministic tap geometry (tests). */
const LINE_WIDTH = 100;
/** locationX of a value on the [0, 20] line rendered at LINE_WIDTH px. */
function xOf(value: number): number {
  return ((value - NORMAL.lineMin) / (NORMAL.lineMax - NORMAL.lineMin)) * LINE_WIDTH;
}

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
  return { completeSession } as unknown as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <NumberLineScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
      numberLineWidth={LINE_WIDTH}
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

/** Tap the line at the exact position of `value`. */
async function tapValue(value: number) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number-line')), {
    nativeEvent: { locationX: xOf(value) },
  });
}

describe('NumberLineScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a miss shows the guess next to the flag with the wrong cue and keeps the prompt', async () => {
    const seed = 'verdict-miss';
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const target = generateSessionRounds(createRng(seed), NORMAL)[0].target;
    // Far outside the 6%-of-span tolerance, clamped into the line range.
    const miss = target >= 10 ? target - 10 : target + 10;
    await tapValue(miss);

    expect(screen.getByTestId(testId(GAME_ID, 'round-miss'))).toBeOnTheScreen();
    // Correct position and guess visible together in the resolved frame …
    expect(screen.getByTestId(testId(GAME_ID, 'line-flag'))).toBeOnTheScreen();
    const guess = screen.getByTestId(testId(GAME_ID, 'line-guess'), { includeHiddenElements: true });
    expect(guess).toBeOnTheScreen();
    expect(within(guess).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(guess).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    // … the prompt stays mounted while feedback shows …
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toHaveTextContent(
      'Where does the flag sit?',
    );
    // … the reveal names both positions, and the verdict is in words.
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
      `The flag was at ${target}. You tapped ${miss}.`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'number-line')).props.accessibilityLabel).toMatch(
      /Too far off/,
    );
  });

  it('a hit marks the guess with the correct cue', async () => {
    const seed = 'verdict-hit';
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const target = generateSessionRounds(createRng(seed), NORMAL)[0].target;
    await tapValue(target);

    expect(screen.getByTestId(testId(GAME_ID, 'round-hit'))).toBeOnTheScreen();
    const guess = screen.getByTestId(testId(GAME_ID, 'line-guess'), { includeHiddenElements: true });
    expect(within(guess).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(guess).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'number-line')).props.accessibilityLabel).toMatch(
      /Correct/,
    );
  });

  it('a timeout shows the flag alone with no guess marker', async () => {
    const seed = 'verdict-timeout';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const target = generateSessionRounds(createRng(seed), NORMAL)[0].target;
    await advanceTime(clock, BUDGET_MS + 1000);

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'line-flag'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'line-guess'), { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
      `The flag was at ${target}.`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'number-line')).props.accessibilityLabel).toMatch(
      /Timed out/,
    );
  });

  it('animates the score live in session and in results', async () => {
    await renderScreen({ seed: 'verdict-score' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toBeOnTheScreen();
  });
});
