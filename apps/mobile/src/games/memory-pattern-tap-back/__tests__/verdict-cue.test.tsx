/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Pattern Tap Back.
 *
 * The resolved round must present its verdict through fill + border + glyph
 * and through the accessible name on the tile itself: a passed round marks
 * every reached sequence position ✓ ("Correct: Tile N"), a failure marks the
 * wrong tap ✕ ("Wrong pick: Tile N") together with the position the player
 * was on ("Correct: Tile N") in the same frame. Positions the round never
 * reached stay neutral. Feedback is inline: the board the player was
 * reproducing stays mounted beside the verdict. Scores animate through
 * `AnimatedNumber` (`score-live` in session, `score-final` in results).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

import { adaptiveGridSize, paramsFromProfile, resolvePatternTapBackDifficulty } from '../difficulty';
import { generateRoundSequence } from '../generator';
import { roundScore } from '../scoring';
import PatternTapBackScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PARAMS = paramsFromProfile(resolvePatternTapBackDifficulty('normal'));

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
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <PatternTapBackScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the pacing timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** The sequence the reducer generates for a normal session's first round. */
function roundZeroSequence(seed: string) {
  return generateRoundSequence({
    rng: createRng(seed),
    roundIndex: 0,
    length: PARAMS.initialSequenceLength,
    gridSize: adaptiveGridSize(0, PARAMS),
    prevSequence: null,
  });
}

/** Run the observe pacing until recall starts (one tick per sequence step). */
async function observeFirstRound(clock: ReturnType<typeof createFakeClock>) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  for (let tick = 0; tick < PARAMS.initialSequenceLength; tick += 1) {
    await advanceTime(clock, PARAMS.baseObserveMs + PARAMS.stepObserveMs * tick);
  }
  expect(screen.getByTestId(testId(GAME_ID, 'recall-grid'))).toBeOnTheScreen();
}

/** Flatten a (possibly press-state function) style to its resolved object. */
function flatStyle(element: { props: { style?: unknown } }) {
  const { style } = element.props;
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved);
}

describe('PatternTapBackScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks every reached sequence position correct after a passed round and leaves the rest neutral', async () => {
    const seed = 'ptb-verdict-pass';
    const { clock } = await renderScreen({ seed });
    await observeFirstRound(clock);

    const sequence = roundZeroSequence(seed);
    for (const tile of sequence) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
      // Clear the recall auto-highlight so the next tap is accepted.
      await advanceTime(clock, 200);
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    const reached = new Set(sequence);
    for (const tile of reached) {
      const tileEl = screen.getByTestId(testId(GAME_ID, 'tile', String(tile)));
      expect(tileEl.props.accessibilityLabel).toBe(`Correct: Tile ${tile + 1}`);
      const badge = screen.getByTestId(testId(GAME_ID, 'tile-verdict', String(tile)), {
        includeHiddenElements: true,
      });
      expect(badge).toHaveTextContent('✓');
      expect(badge).not.toHaveTextContent('✕');
      expect(badge.props.importantForAccessibility).toBe('no-hide-descendants');
    }

    // Untouched positions stay neutral: no badge, no verdict wording.
    for (let tile = 0; tile < PARAMS.gridSize; tile += 1) {
      if (reached.has(tile)) continue;
      const tileEl = screen.getByTestId(testId(GAME_ID, 'tile', String(tile)));
      expect(tileEl.props.accessibilityLabel).toBe(`Tile ${tile + 1}`);
      expect(
        screen.queryByTestId(testId(GAME_ID, 'tile-verdict', String(tile)), {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    }
  });

  it('shows a wrong pick and the correct target together, keeping the board and prompt visible', async () => {
    const seed = 'ptb-verdict-wrong';
    const { clock } = await renderScreen({ seed });
    await observeFirstRound(clock);

    const sequence = roundZeroSequence(seed);
    const expected = sequence[0];
    const wrong = (expected + 1) % PARAMS.gridSize;
    expect(wrong).not.toBe(expected);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrong))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    // The wrong tap carries ✕ + "Wrong pick", never ✓ / "Correct".
    const wrongEl = screen.getByTestId(testId(GAME_ID, 'tile', String(wrong)));
    expect(wrongEl.props.accessibilityLabel).toBe(`Wrong pick: Tile ${wrong + 1}`);
    expect(wrongEl.props.accessibilityLabel).not.toMatch(/Correct/);
    const wrongBadge = screen.getByTestId(testId(GAME_ID, 'tile-verdict', String(wrong)), {
      includeHiddenElements: true,
    });
    expect(wrongBadge).toHaveTextContent('✕');
    expect(wrongBadge).not.toHaveTextContent('✓');
    expect(wrongBadge.props.importantForAccessibility).toBe('no-hide-descendants');

    // …and the correct sequence position is distinguishable in the same frame.
    const expectedEl = screen.getByTestId(testId(GAME_ID, 'tile', String(expected)));
    expect(expectedEl.props.accessibilityLabel).toBe(`Correct: Tile ${expected + 1}`);
    expect(
      screen.getByTestId(testId(GAME_ID, 'tile-verdict', String(expected)), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✓');

    // Distinct fills + verdict-thick boundaries back the glyphs (never colour-alone).
    expect(flatStyle(wrongEl).backgroundColor).not.toBe(flatStyle(expectedEl).backgroundColor);
    expect(flatStyle(wrongEl)).toMatchObject({ borderWidth: 3, minHeight: MIN_TOUCH_TARGET });
    expect(flatStyle(expectedEl)).toMatchObject({ borderWidth: 3, minHeight: MIN_TOUCH_TARGET });

    // Untouched tiles stay neutral — only the two verdicts exist on the board.
    for (let tile = 0; tile < PARAMS.gridSize; tile += 1) {
      if (tile === wrong || tile === expected) continue;
      expect(
        screen.queryByTestId(testId(GAME_ID, 'tile-verdict', String(tile)), {
          includeHiddenElements: true,
        }),
      ).toBeNull();
      expect(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))).props.accessibilityLabel).toBe(
        `Tile ${tile + 1}`,
      );
    }

    // Feedback is inline: the verdict, the board the player was reproducing
    // and the sequence recap all stay mounted in the same frame.
    const roundResult = screen.getByTestId(testId(GAME_ID, 'round-result'));
    expect(within(roundResult).getByTestId(testId(GAME_ID, 'round-result-grid'))).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(`Sequence length ${PARAMS.initialSequenceLength}`))).toBeOnTheScreen();
  });

  it('animates the score live in session and in results', async () => {
    const seed = 'ptb-verdict-score';
    const { clock } = await renderScreen({ seed });
    await observeFirstRound(clock);

    // Live count-up readout beside the HUD score, visible while answering.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    const sequence = roundZeroSequence(seed);
    for (const tile of sequence) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
      await advanceTime(clock, 200);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    // Still mounted through the verdict, settled on the round's gain.
    await advanceTime(clock, 1000);
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toHaveTextContent(
      String(roundScore(PARAMS.initialSequenceLength)),
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
