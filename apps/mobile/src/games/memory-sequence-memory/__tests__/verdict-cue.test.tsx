/**
 * Verdict-cue contract (campaign 025) for Sequence Memory.
 *
 * A correct step shows the shared verdict cue while the round is live —
 * verdict-family soft fill, verdict-family border and a ✓ badge, announced as
 * "Correct: Pad N". A wrong tap marks that tile ✕/"Wrong pick: Pad N" and
 * leaves the expected step ✓-marked beside it in the same frame. Untouched
 * tiles stay neutral, the input prompt stays mounted through feedback, and
 * the score animates (`score-live` in session, `score-final` in results).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateSequence } from '../generator';
import SequenceMemoryScreen from '../screen';
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

async function renderScreen(options: { seed?: string; clock?: ReturnType<typeof createFakeClock> } = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const persister = makePersister();
  const result = await render(
    <SequenceMemoryScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
    />,
  );
  return { clock, persister, result };
}

/** Advance both the fake lifecycle clock and the screen timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Reveal the current round fully (one advance per tile; timers chain per flush). */
async function revealRound(clock: ReturnType<typeof createFakeClock>, length: number) {
  for (let tick = 0; tick < length; tick += 1) {
    await advanceTime(clock, REVEAL_MS);
  }
}

/** The round-0 sequence the reducer generates on normal difficulty. */
function expectedSequence(seed: string) {
  return generateSequence({
    rng: createRng(seed),
    sequenceIndex: 0,
    length: 3,
    tileCount: 4,
    prevSequence: null,
  });
}

describe('SequenceMemoryScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks a correct step and leaves untouched tiles neutral', async () => {
    const seed = 'verdict-step';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await revealRound(clock, 3);
    expect(screen.getByTestId(testId(GAME_ID, 'input-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    const sequence = expectedSequence(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0]))));

    // Correct step: verdict in the accessible name plus a hidden decorative
    // shape cue, so the outcome never leans on colour alone.
    const correctTile = screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0])));
    expect(correctTile.props.accessibilityLabel).toBe(`Correct: Pad ${sequence[0] + 1}`);
    expect(within(correctTile).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(correctTile).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    const badge = screen.getByTestId(testId(GAME_ID, 'tile-verdict', String(sequence[0])), {
      includeHiddenElements: true,
    });
    expect(badge.props.importantForAccessibility).toBe('no-hide-descendants');

    // Untouched tiles stay neutral — no glyph, no verdict wording.
    for (let index = 0; index < 4; index += 1) {
      if (index === sequence[0]) continue;
      const idle = screen.getByTestId(testId(GAME_ID, 'tile', String(index)));
      expect(idle.props.accessibilityLabel).toBe(`Pad ${index + 1}`);
      expect(within(idle).queryByText('✓', { includeHiddenElements: true })).toBeNull();
      expect(within(idle).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    }
  });

  it('shows the wrong tap together with the correct sequence position', async () => {
    const seed = 'verdict-wrong';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await revealRound(clock, 3);

    const sequence = expectedSequence(seed);
    // One correct step, then a wrong tile distinct from both the matched step
    // and the expected one, so the three cues land on distinct tiles.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0]))));
    const wrongTile = [0, 1, 2, 3].find((tile) => tile !== sequence[0] && tile !== sequence[1])!;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    // The wrong pick reads as wrong and never as correct.
    const wrongEl = screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile)));
    expect(wrongEl.props.accessibilityLabel).toBe(`Wrong pick: Pad ${wrongTile + 1}`);
    expect(wrongEl.props.accessibilityLabel).not.toContain('Correct');
    expect(within(wrongEl).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(wrongEl).queryByText('✓', { includeHiddenElements: true })).toBeNull();

    // The correct sequence position is marked in the same frame …
    const expectedEl = screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[1])));
    expect(expectedEl.props.accessibilityLabel).toBe(`Correct: Pad ${sequence[1] + 1}`);
    expect(within(expectedEl).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    // … the matched prefix keeps its cue …
    const matchedEl = screen.getByTestId(testId(GAME_ID, 'tile', String(sequence[0])));
    expect(matchedEl.props.accessibilityLabel).toBe(`Correct: Pad ${sequence[0] + 1}`);
    // … and the full expected sequence stays listed as text beside the board.
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toHaveTextContent(
      new RegExp(`expected ${sequence.map((tile) => tile + 1).join(' · ')}`),
    );

    // The prompt stays mounted while the verdict shows.
    expect(screen.getByTestId(testId(GAME_ID, 'input-status'))).toHaveTextContent('Now repeat it');
  });

  it('animates the score live in session and in results', async () => {
    const seed = 'verdict-score';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Live count-up readout visible while answering.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await revealRound(clock, 3);
    for (const tile of expectedSequence(seed)) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    // Still mounted behind the verdict so the gain reads as movement.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
    // The plain StatRow score survives next to the animated readout.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toBeOnTheScreen();
  });
});
