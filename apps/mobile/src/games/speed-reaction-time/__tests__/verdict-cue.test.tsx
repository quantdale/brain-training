/**
 * ReactionTime verdict-cue contract (Campaign 025, speed-round feedback model).
 *
 * Proves each resolved round presents the shared verdict vocabulary: a soft
 * fill, a boundary and a ✓/✕/⏱ glyph badge plus a text label and an accessible
 * name (never colour alone) derived from the reducer's `roundOutcome` — for
 * passed, withheld, timeout, false-start and no-go outcomes. The result card
 * keeps the round prompt visible under the verdict, scores animate through
 * `AnimatedNumber` (`score-live` / `score-final`), and a tap that crosses the
 * response window presents the expiry's timeout, never an optimistic success.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  liveAudioHaptics,
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { SPEED_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundDelay, isNoGoRound } from '../generator';
import SpeedScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = SPEED_DIFFICULTY_PARAMS.normal;

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

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  const result = await render(
    <SpeedScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** Advance both the fake lifecycle clock and the pending timers. */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Advance only the lifecycle clock (reaction time passes; no timers fire). */
async function advanceClock(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
  });
}

function delayFor(seed: string, roundIndex: number): number {
  return generateRoundDelay({
    rng: createRng(seed),
    roundIndex,
    minDelayMs: NORMAL.minDelayMs,
    maxDelayMs: NORMAL.maxDelayMs,
  });
}

function isNoGoTrial(seed: string, roundIndex: number): boolean {
  return isNoGoRound({
    rng: createRng(seed),
    roundIndex,
    noGoProbability: NORMAL.noGoProbability,
  });
}

/** First `prefix-N` seed whose early normal rounds are all plain GO. */
function findPlainGoSeed(prefix: string, rounds = 3): string {
  outer: for (let i = 0; i < 100_000; i += 1) {
    const candidate = `${prefix}-${i}`;
    for (let round = 0; round < rounds; round += 1) {
      if (isNoGoTrial(candidate, round)) {
        continue outer;
      }
    }
    return candidate;
  }
  throw new Error(`findPlainGoSeed: exhausted seed space for ${prefix}`);
}

/** First `prefix-N` seed whose round 0 is a NO-GO trial. */
function findNoGoSeed(prefix: string): string {
  for (let i = 0; i < 100_000; i += 1) {
    const candidate = `${prefix}-${i}`;
    if (isNoGoTrial(candidate, 0)) {
      return candidate;
    }
  }
  throw new Error(`findNoGoSeed: exhausted seed space for ${prefix}`);
}

async function reachGo(clock: ReturnType<typeof createFakeClock>, seed: string, roundIndex: number) {
  await advanceTime(clock, delayFor(seed, roundIndex));
  expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
}

function verdictCue() {
  return screen.getByTestId(testId(GAME_ID, 'verdict-cue'));
}

describe('ReactionTimeScreen verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a fast reaction shows the ✓ passed cue with the prompt recap', async () => {
    const seed = findPlainGoSeed('verdict-pass', 1);
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
    await reachGo(clock, seed, 0);
    await advanceClock(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    const cue = verdictCue();
    expect(cue.props.accessibilityLabel).toBe('Last round: passed');
    expect(within(cue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).getByText('Passed')).toBeOnTheScreen();
    expect(within(cue).queryByText('✕', { includeHiddenElements: true })).toBeNull();

    // The prompt stays readable under the verdict (R3).
    expect(screen.getByTestId(testId(GAME_ID, 'round-prompt'))).toHaveTextContent(
      'Prompt: tap the instant it turns green',
    );
  });

  it('a withheld NO-GO round shows the ✓ held cue, not a miss', async () => {
    const seed = findNoGoSeed('verdict-hold');
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, delayFor(seed, 0));
    expect(screen.getByTestId(testId(GAME_ID, 'hold-status'))).toBeOnTheScreen();

    // Surviving the withhold window resolves the round as a correct withhold.
    await advanceTime(clock, NORMAL.timeoutMs);
    expect(screen.getByTestId(testId(GAME_ID, 'round-withheld'))).toBeOnTheScreen();
    const cue = verdictCue();
    expect(cue.props.accessibilityLabel).toBe('Last round: held');
    expect(within(cue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round-prompt'))).toHaveTextContent(
      'Prompt: hold — do not tap the ✕ signal',
    );
  });

  it('a timeout shows the ⏱ timed-out cue, not a passed cue', async () => {
    const seed = findPlainGoSeed('verdict-timeout', 1);
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await reachGo(clock, seed, 0);
    await advanceTime(clock, NORMAL.timeoutMs);

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    const cue = verdictCue();
    expect(cue.props.accessibilityLabel).toBe('Last round: timed out');
    expect(within(cue).getByText('⏱', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round-prompt'))).toBeOnTheScreen();
  });

  it('a pre-GO false start shows the ✕ mistake cue', async () => {
    const seed = 'verdict-false-start';
    await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-false-start'))).toBeOnTheScreen();
    const cue = verdictCue();
    expect(cue.props.accessibilityLabel).toBe('Last round: false start');
    expect(within(cue).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });

  it('a late tap past the response window stays silent and the expiry owns the timeout', async () => {
    const seed = findPlainGoSeed('verdict-late', 1);
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await reachGo(clock, seed, 0);

    // Cross the response window on the lifecycle clock only: the expiry timer
    // is still pending, so this is the timer/dispatch scheduling gap.
    await act(async () => {
      clock.advance(NORMAL.timeoutMs + 1);
    });
    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    const haptic = jest.spyOn(liveAudioHaptics, 'haptic');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));

    // The late tap resolved nothing: no sensory feedback, no passed card.
    expect(playSfx).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-passed'))).toBeNull();

    // The expiry timer owns the resolution: a timeout, not the late reaction.
    await act(async () => {
      jest.advanceTimersByTime(NORMAL.timeoutMs + 10);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    const cue = verdictCue();
    expect(cue.props.accessibilityLabel).toBe('Last round: timed out');
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });

  it('animates the score live in session and in results', async () => {
    await renderScreen('verdict-score');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
    // The plain StatRow score survives next to the animated readout.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toBeOnTheScreen();
  });
});
