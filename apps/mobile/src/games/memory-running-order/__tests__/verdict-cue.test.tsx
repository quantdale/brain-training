/**
 * Verdict-cue contract (PATTERNS-PLAY 6, campaign 025) for Running Order.
 *
 * The round verdict is presentation-only and derived from the reducer's
 * resolved `roundResult` state (never from the tap handler): every recalled
 * position carries a soft fill, a verdict border and a ✓/✕ badge plus the
 * verdict in its accessible name; after a wrong submission the mismatched
 * position shows the wrong pick together with the correct symbol for that
 * position while the full target row stays visible; untouched palette options
 * stay neutral; the prompt stays mounted behind the feedback. Scores animate
 * with `AnimatedNumber` (`score-live` in session, `score-final` in results
 * beside the existing `<game>.score` StatRow).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { FakeClock } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

import { RUNNING_ORDER_DIFFICULTY_PARAMS } from '../difficulty';
import { generateStream, streamTarget } from '../generator';
import RunningOrderScreen from '../screen';
import type { SessionPersistence } from '../session';
import { SYMBOL_COUNT, symbolById } from '../symbols';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;
const FLASH_MS = NORMAL.flashMs;
const STREAM_LEN = NORMAL.streamLen;
const RECALL = NORMAL.initialRecallLength;

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
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

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  await render(
    <RunningOrderScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock };
}

/** Advance both the fake lifecycle clock and the flash pacing timer. */
async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Play the round-0 reveal out: one paced flash per stream symbol. */
async function revealStream(clock: FakeClock) {
  for (let i = 0; i < STREAM_LEN; i += 1) {
    await advanceTime(clock, FLASH_MS);
  }
}

/** The target the reducer resolves for the normal-session round 0. */
function expectedTarget(seed: string): number[] {
  const stream = generateStream({
    rng: createRng(seed),
    roundIndex: 0,
    streamLen: STREAM_LEN,
    recallLength: RECALL,
    prevTarget: null,
  });
  return streamTarget(stream, RECALL);
}

/** Start a session and drive the reveal until the input phase opens. */
async function startAndEnterInput(seed: string) {
  const { clock } = await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  await revealStream(clock);
  expect(screen.getByTestId(testId(GAME_ID, 'input'))).toBeOnTheScreen();
  return { clock };
}

async function submitAnswer(answer: readonly number[]) {
  for (const id of answer) {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'palette', String(id))));
  }
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
}

/** Flatten a (possibly press-state function) style to its resolved object. */
function flatStyle(element: { props: { style?: unknown } }) {
  const { style } = element.props;
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved);
}

describe('RunningOrderScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks a correct order with fill, verdict border, ✓ badge and verdict name', async () => {
    const seed = 'ro-verdict-correct';
    await startAndEnterInput(seed);
    const target = expectedTarget(seed);
    await submitAnswer(target);

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    for (let i = 0; i < target.length; i += 1) {
      const slot = screen.getByTestId(testId(GAME_ID, 'result-answer', String(i)));
      expect(String(slot.props.accessibilityLabel)).toBe(
        `Correct: ${symbolById(target[i]).label}`,
      );
      expect(within(slot).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(within(slot).queryByText('✕', { includeHiddenElements: true })).toBeNull();
      expect(flatStyle(slot).borderWidth).toBe(3);
    }
    // A correct round shows no wrong-pick companion slots.
    expect(screen.queryByTestId(testId(GAME_ID, 'result-correct', '0'))).toBeNull();

    // The prompt stays mounted through the verdict and the live score keeps
    // counting (no reflow to the results view).
    expect(screen.getByTestId(testId(GAME_ID, 'input-status'))).toHaveTextContent(
      `Recall the last ${RECALL} in order`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
  });

  it('shows the wrong pick together with the correct symbol and the full target', async () => {
    const seed = 'ro-verdict-wrong';
    await startAndEnterInput(seed);
    const target = expectedTarget(seed);
    // Corrupt exactly the first position: only that slot may read wrong.
    const wrongId = (target[0] + 1) % SYMBOL_COUNT;
    const answer = [wrongId, ...target.slice(1)];
    await submitAnswer(answer);

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    const wrongSlot = screen.getByTestId(testId(GAME_ID, 'result-answer', '0'));
    expect(String(wrongSlot.props.accessibilityLabel)).toMatch(/^Wrong pick:/);
    expect(within(wrongSlot).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(wrongSlot).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(flatStyle(wrongSlot).borderWidth).toBe(3);

    // The correct symbol for the SAME position is in the same frame (R2).
    const correctSlot = screen.getByTestId(testId(GAME_ID, 'result-correct', '0'));
    expect(String(correctSlot.props.accessibilityLabel)).toBe(
      `Correct: ${symbolById(target[0]).label}`,
    );
    expect(
      within(correctSlot).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    // Distinct fills back the glyphs — never colour-alone, never identical.
    expect(flatStyle(wrongSlot).backgroundColor).not.toBe(
      flatStyle(correctSlot).backgroundColor,
    );

    // Positions that matched still read correct, not wrong.
    const matchingSlot = screen.getByTestId(testId(GAME_ID, 'result-answer', '1'));
    expect(String(matchingSlot.props.accessibilityLabel)).toMatch(/^Correct:/);
    expect(
      within(matchingSlot).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    // The full correct order remains visible in the verdict frame.
    for (let i = 0; i < target.length; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'result-target', String(i)))).toBeOnTheScreen();
    }

    // Prompt stays mounted while the verdict shows (R3).
    expect(screen.getByTestId(testId(GAME_ID, 'input-status'))).toHaveTextContent(
      `Recall the last ${RECALL} in order`,
    );
  });

  it('keeps untouched palette options neutral and at the touch-target floor', async () => {
    const seed = 'ro-verdict-neutral';
    await startAndEnterInput(seed);

    for (let id = 0; id < SYMBOL_COUNT; id += 1) {
      const option = screen.getByTestId(testId(GAME_ID, 'palette', String(id)));
      expect(String(option.props.accessibilityLabel)).toBe(symbolById(id).label);
      expect(within(option).queryByText('✓', { includeHiddenElements: true })).toBeNull();
      expect(within(option).queryByText('✕', { includeHiddenElements: true })).toBeNull();
      // R6: every tappable palette symbol meets the touch-target floor.
      expect(flatStyle(option)).toMatchObject({
        minHeight: MIN_TOUCH_TARGET,
        minWidth: MIN_TOUCH_TARGET,
      });
    }
  });

  it('animates the score live in session and in results', async () => {
    const seed = 'ro-verdict-score';
    await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
