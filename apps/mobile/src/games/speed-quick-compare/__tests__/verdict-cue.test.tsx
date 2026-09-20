/**
 * QuickCompare verdict-cue contract (Campaign 025, speed-round feedback model).
 *
 * Proves the resolved round presents the shared verdict vocabulary: a soft
 * fill, a boundary and a ✓/✕/⏱ glyph badge plus a text label and an
 * accessible name (never colour alone). A wrong pick shows the wrong cue AND
 * the correct option in the same frame; the prompt (question + stimuli) stays
 * mounted behind the verdict; and a tap that crosses the deadline presents the
 * reducer's timeout resolution, never an optimistic success. Scores animate
 * through `AnimatedNumber` (`score-live` in session, `score-final` in results)
 * beside the surviving plain `score` StatRow.
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

import { quickCompareParamsForLevel } from '../difficulty';
import { generateRound } from '../generator';
import QuickCompareScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const SEED = 'verdict-cue';
const PARAMS = quickCompareParamsForLevel('normal');

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

async function renderScreen() {
  const clock = createFakeClock(0);
  const result = await render(
    <QuickCompareScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={SEED}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** The deterministic round 0 the reducer generates for this seed. */
function round0() {
  return generateRound(createRng(SEED), 0, PARAMS);
}

/** A non-correct option index for round 0. */
function wrongIndex(): number {
  const round = round0();
  return round.optionLabels.findIndex((_, index) => index !== round.correctIndex);
}

function option(index: number) {
  return screen.getByTestId(testId(GAME_ID, 'option', String(index)));
}

describe('QuickCompareScreen verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a correct pick shows the ✓ cue and keeps the prompt mounted', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Live score is visible while playing; no verdict exists yet.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict-cue'))).toBeNull();

    const round = round0();
    await fireEvent.press(option(round.correctIndex));

    const cue = screen.getByTestId(testId(GAME_ID, 'verdict-cue'));
    expect(cue.props.accessibilityLabel).toBe('Last pick: correct');
    expect(within(cue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).getByText('Correct')).toBeOnTheScreen();
    expect(within(cue).queryByText('✕', { includeHiddenElements: true })).toBeNull();

    // The prompt (question + both stimuli) stays mounted behind the verdict.
    expect(screen.getByTestId(testId(GAME_ID, 'comparison'))).toBeOnTheScreen();
    expect(screen.getByTestId(`${GAME_ID}.comparison-question`)).toBeOnTheScreen();
    expect(screen.getByTestId(`${GAME_ID}.comparison-left-value`)).toBeOnTheScreen();
    expect(screen.getByTestId(`${GAME_ID}.comparison-right-value`)).toBeOnTheScreen();

    // The chosen option carries the same success cue as the strip.
    const correctOption = option(round.correctIndex);
    expect(within(correctOption).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(correctOption.props.accessibilityLabel).toMatch(/Correct/);
  });

  it('a wrong pick marks the wrong option AND the correct option together', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const round = round0();
    const wrong = wrongIndex();
    await fireEvent.press(option(wrong));

    const cue = screen.getByTestId(testId(GAME_ID, 'verdict-cue'));
    expect(cue.props.accessibilityLabel).toBe('Last pick: wrong');
    expect(within(cue).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();

    const wrongOption = option(wrong);
    const correctOption = option(round.correctIndex);
    // Wrong cue on the tapped option …
    expect(within(wrongOption).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(wrongOption.props.accessibilityLabel).toMatch(/Wrong pick/);
    // … correct cue alongside it on the true option …
    expect(within(correctOption).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(correctOption.props.accessibilityLabel).toMatch(/Correct/);
    // … and the wrong pick never reads as correct.
    expect(within(wrongOption).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/Correct/);

    // Prompt still visible in the same frame.
    expect(screen.getByTestId(`${GAME_ID}.comparison-question`)).toBeOnTheScreen();
  });

  it('a tap after the deadline presents the miss resolution, never success', async () => {
    const { clock } = await renderScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = round0();

    // Cross the deadline on the lifecycle clock only: the expiry timer is
    // still pending, so this is the timer/dispatch scheduling gap.
    await act(async () => {
      clock.advance(PARAMS.windowMs + 1);
    });

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    const haptic = jest.spyOn(liveAudioHaptics, 'haptic');
    await fireEvent.press(option(round.correctIndex));

    // The tap resolved nothing: no verdict cue and no success feedback.
    expect(playSfx).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict-cue'))).toBeNull();

    // The expiry timer owns the resolution: a miss, not the late pick.
    await act(async () => {
      jest.advanceTimersByTime(PARAMS.windowMs + 10);
    });
    const cue = screen.getByTestId(testId(GAME_ID, 'verdict-cue'));
    expect(cue.props.accessibilityLabel).toBe('Last pick: timed out');
    expect(within(cue).getByText('⏱', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    // The true option is still revealed for the review.
    expect(
      within(option(round.correctIndex)).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(`${GAME_ID}.comparison-question`)).toBeOnTheScreen();
  });

  it('animates the score live in session and in results', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
