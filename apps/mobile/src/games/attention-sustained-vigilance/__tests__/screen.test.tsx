// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import VigilanceScreen from '../screen';
import { VIGILANCE_DIFFICULTY_PARAMS } from '../difficulty';
import { generateStream } from '../generator';
import { GAME_ID } from '../types';
import {
  createInMemoryTutorialStore,
  createRng,
  noopAudioHaptics,
  setLiveAudioHaptics,
  testId,
} from '@/sdk';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** A seed whose first trial is a go trial, so a GO tap is meaningful. */
function goFirstSeed(): string {
  const params = VIGILANCE_DIFFICULTY_PARAMS.normal;
  for (let n = 0; ; n += 1) {
    const seed = `vig-race-${n}`;
    const { trials } = generateStream(createRng(seed), params);
    if (!trials[0].isTarget) {
      return seed;
    }
  }
}

describe('VigilanceScreen verdict', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });

  it('a tap landing after the response window stays silent and still scores a miss', async () => {
    const feedback: string[] = [];
    setLiveAudioHaptics({
      ...noopAudioHaptics,
      feedback: (event) => {
        feedback.push(event);
      },
    });
    try {
      await render(<VigilanceScreen tutorialStore={completedStore()} sessionSeed={goFirstSeed()} />);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
      // Normal window is 1200 ms on 250 ms ticks: at 1210 ms the window has
      // closed but the resolving tick (1250 ms) has not fired yet, so the
      // verdict is still pending and GO is still enabled.
      await act(async () => {
        jest.advanceTimersByTime(1210);
      });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
      // The late tap is a reducer no-op: no press feedback, no success verdict.
      expect(feedback).toEqual([]);
      expect(screen.queryByText('Go!')).toBeNull();
      // The pending tick resolves the trial as a miss.
      await act(async () => {
        jest.advanceTimersByTime(40);
      });
      expect(screen.getByText('Missed one')).toBeTruthy();
      expect(screen.queryByText('Go!')).toBeNull();
      expect(feedback).toEqual(['failure']);
    } finally {
      setLiveAudioHaptics(noopAudioHaptics);
    }
  });

  it('a tap inside the window shows the hit verdict and clears the digit', async () => {
    const seed = goFirstSeed();
    const { trials } = generateStream(createRng(seed), VIGILANCE_DIFFICULTY_PARAMS.normal);
    await render(<VigilanceScreen tutorialStore={completedStore()} sessionSeed={seed} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    // The digit is on screen before the tap resolves the trial.
    expect(screen.getByText(String(trials[0].digit))).toBeTruthy();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    expect(screen.getByText('Go!')).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'stage-verdict'), { includeHiddenElements: true }),
    ).toBeTruthy();
    // Resolution clears the stimulus immediately (Campaign 027): the digit
    // node stays mounted (no layout churn) but renders the blank marker.
    expect(screen.queryByText(String(trials[0].digit))).toBeNull();
    expect(
      screen.getByTestId(testId(GAME_ID, 'stimulus-digit')).props.children,
    ).toBe('·');
  });
});
