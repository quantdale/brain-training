/**
 * Verdict-cue contract (PATTERNS-PLAY 6, FEEDBACK-CHOREOGRAPHY).
 *
 * After a wrong submission the round-result board must mark the wrong tap AND
 * the tracked cells with distinct fill + glyph cues, and the wrong cell must
 * never read as correct.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import type { FakeClock } from '@/sdk';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

import SymbolTrackerScreen from '../screen';
import { EMPTY, generateRound } from '../generator';
import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID } from '../types';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;

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

async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Flatten a (possibly press-state function) style to its resolved object. */
function flatStyle(element: { props: { style?: unknown } }) {
  const { style } = element.props;
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved);
}

describe('SymbolTrackerScreen verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong tap and the tracked cells with distinct fill + glyph cues', async () => {
    const seed = 'verdict-cue';
    const clock = createFakeClock(0);
    await render(
      <SymbolTrackerScreen
        clock={clock}
        tutorialStore={completedStore()}
        sessionSeed={seed}
        persistSession={makePersister()}
      />,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, NORMAL.observeMs);
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();

    const round = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      gridSize: NORMAL.gridSize,
      tokenCount: NORMAL.tokenCount,
      trackCount: NORMAL.initialTrackCount,
      distractors: NORMAL.distractors,
      prevTracked: null,
    });
    const trackedIds = round.trackedSymbolIds;
    const wrongCell = round.respondBoard.findIndex((id) => id !== EMPTY && !trackedIds.includes(id));
    expect(wrongCell).toBeGreaterThanOrEqual(0);
    const correctCell = round.respondBoard.findIndex((id) => trackedIds.includes(id));
    expect(correctCell).toBeGreaterThanOrEqual(0);
    expect(correctCell).not.toBe(wrongCell);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'cell', String(wrongCell))));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    // Feedback must not cover the prompt: the round summary stays visible
    // alongside the marked board.
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result-board'))).toBeOnTheScreen();

    const wrongBadge = screen.getByTestId(testId(GAME_ID, 'cell-verdict', String(wrongCell)), {
      includeHiddenElements: true,
    });
    const correctBadge = screen.getByTestId(
      testId(GAME_ID, 'cell-verdict', String(correctCell)),
      { includeHiddenElements: true },
    );
    expect(wrongBadge).toHaveTextContent('✕');
    expect(wrongBadge).not.toHaveTextContent('✓');
    expect(correctBadge).toHaveTextContent('✓');
    expect(correctBadge).not.toHaveTextContent('✕');

    // Distinct fills back the glyphs (never colour-alone, never identical).
    const wrongCellEl = screen.getByTestId(testId(GAME_ID, 'cell', String(wrongCell)));
    const correctCellEl = screen.getByTestId(testId(GAME_ID, 'cell', String(correctCell)));
    expect(flatStyle(wrongCellEl).backgroundColor).not.toBe(
      flatStyle(correctCellEl).backgroundColor,
    );

    // Distinct accessibility labels: the wrong pick never reads as correct.
    const wrongLabel = String(wrongCellEl.props.accessibilityLabel);
    const correctLabel = String(correctCellEl.props.accessibilityLabel);
    expect(wrongLabel).toMatch(/^Wrong pick:/);
    expect(wrongLabel).not.toMatch(/^Correct/);
    expect(correctLabel).toMatch(/^Correct:/);

    // The live score readout is visible during the session.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    // Board cells meet the touch-target floor.
    expect(flatStyle(wrongCellEl)).toMatchObject({ minHeight: MIN_TOUCH_TARGET });
  });
});
