/**
 * MemoryScreen verdict-cue tests (shared feedback language).
 *
 * Proves the board marks verdicts by shape as well as fill: correctly tapped
 * tiles carry a `✓` badge with a "Correct:" label while the wrong pick
 * carries a `✕` badge with a "Wrong pick:" label — the wrong pick never
 * reads as correct — and that the failed tile stays error-marked in
 * roundResult alongside the revealed expected sequence.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateRoundSequence } from '../generator';
import MemoryScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const REVEAL_MS = 900;

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

async function renderScreen(options: {
  seed?: string;
  store?: ReturnType<typeof createInMemoryTutorialStore>;
  clock?: ReturnType<typeof createFakeClock>;
  persister?: ReturnType<typeof makePersister>;
} = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <MemoryScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the reveal timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('MemoryScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks correct taps and the wrong pick with distinct shape cues and keeps the failed tile error-marked', async () => {
    const seed = 'verdict-cue';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let tick = 0; tick < 4; tick += 1) {
      await advanceTime(clock, REVEAL_MS);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'input-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    const sequence = generateRoundSequence({
      rng: createRng(seed),
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });

    // One correct tap first: the matched tile reads correct by shape and label.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0]))));
    const correctTile = screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0])));
    expect(correctTile.props.accessibilityLabel).toBe(`Correct: Tile ${sequence[0] + 1}`);
    expect(within(correctTile).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(correctTile).queryByText('✕', { includeHiddenElements: true })).toBeNull();

    // A wrong tap on any tile other than the expected (and other than the
    // already-matched one, so both cues stay on distinct tiles).
    let wrongTile = (sequence[1] + 1) % 9;
    if (wrongTile === sequence[0]) {
      wrongTile = (wrongTile + 1) % 9;
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    // The wrong pick reads as wrong — shape, label, and explicitly not correct.
    const wrongEl = screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile)));
    expect(wrongEl.props.accessibilityLabel).toBe(`Wrong pick: Tile ${wrongTile + 1}`);
    expect(wrongEl.props.accessibilityLabel).not.toContain('Correct');
    expect(within(wrongEl).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(wrongEl).queryByText('✓', { includeHiddenElements: true })).toBeNull();

    // The failed tile stays error-marked in roundResult (not recolored as
    // correct) while the matched tile keeps its correct cue — and the full
    // expected sequence stays listed as text beside the board.
    const failedEl = screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile)));
    expect(failedEl.props.accessibilityLabel).toBe(`Wrong pick: Tile ${wrongTile + 1}`);
    expect(within(failedEl).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    const matchedEl = screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0])));
    expect(matchedEl.props.accessibilityLabel).toBe(`Correct: Tile ${sequence[0] + 1}`);
    expect(within(matchedEl).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toHaveTextContent(
      new RegExp(`expected ${sequence.map((tile) => tile + 1).join(' · ')}`),
    );
  });
});
