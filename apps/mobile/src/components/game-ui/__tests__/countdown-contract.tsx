/**
 * Shared regression contract for games that show the response-window
 * `Countdown` (not a test file itself: imported by per-game
 * `countdown.test.tsx`). Each game supplies how to advance its fake clock;
 * the helper asserts the display invariants:
 *
 *  - the bar is present in the answer phase and exposes a timer role,
 *  - it is absent while paused,
 *  - after resume it remounts showing the remaining fraction (the paused
 *    interval is not counted down).
 */
import { expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';

import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { Clock, TutorialStore } from '@/sdk';

/** Fill width of the game's countdown as a 0..1 fraction. */
export function readCountdownFraction(gameId: string): number {
  const fill = screen.getByTestId(`${testId(gameId, 'countdown')}-fill`);
  const width = StyleSheet.flatten(fill.props.style).width as string;
  return parseFloat(width) / 100;
}

export function expectCountdownAbsent(gameId: string): void {
  expect(screen.queryByTestId(testId(gameId, 'countdown'))).toBeNull();
}

export interface CountdownContractOptions {
  gameId: string;
  /** Advance the fake clock and any fake timers by `ms`. */
  advance: (ms: number) => Promise<void>;
  /** Run time before sampling a partially elapsed bar (must stay inside the window). */
  elapsedMs: number;
}

/** Call with the answer phase on screen and the session active. */
export async function expectCountdownLifecycle({
  gameId,
  advance,
  elapsedMs,
}: CountdownContractOptions): Promise<void> {
  const track = screen.getByTestId(testId(gameId, 'countdown'));
  expect(track).toBeOnTheScreen();
  expect(track.props.accessibilityRole).toBe('timer');
  expect(track.props.accessibilityLiveRegion).toBeUndefined();

  await advance(elapsedMs);
  const beforePause = readCountdownFraction(gameId);
  expect(beforePause).toBeLessThan(1);
  expect(beforePause).toBeGreaterThan(0);

  await fireEvent.press(screen.getByTestId(testId(gameId, 'pause')));
  expectCountdownAbsent(gameId);

  // Time spent paused must not drain the bar after resume.
  await advance(elapsedMs);
  await fireEvent.press(screen.getByTestId(testId(gameId, 'resume')));
  const afterResume = readCountdownFraction(gameId);
  expect(Math.abs(afterResume - beforePause)).toBeLessThan(0.02);
}

/** The injection seams every GameHost screen exposes. */
export interface CountdownScreenProps {
  clock?: Clock;
  tutorialStore?: TutorialStore;
  sessionSeed?: string | number;
}

export interface RunCountdownContractOptions {
  gameId: string;
  Screen: ComponentType<CountdownScreenProps>;
  elapsedMs: number;
  /** Move from the just-started session to the timed answer phase, if it is not the first phase. */
  toAnswerPhase?: (advance: (ms: number) => Promise<void>) => Promise<void>;
  seed?: string;
}

/**
 * Full per-game regression: render the real screen with a completed tutorial
 * (so the tutorial never shows), start a session, reach the answer phase and
 * run `expectCountdownLifecycle`. Fake timers are scoped to the call.
 */
export async function runCountdownContract({
  gameId,
  Screen,
  elapsedMs,
  toAnswerPhase,
  seed = 'countdown-contract',
}: RunCountdownContractOptions): Promise<void> {
  jest.useFakeTimers();
  try {
    const clock = createFakeClock(0);
    const tutorialStore = createInMemoryTutorialStore();
    tutorialStore.setTutorialState(gameId, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<Screen clock={clock} tutorialStore={tutorialStore} sessionSeed={seed} />);
    // Not present before a session exists (intro).
    expectCountdownAbsent(gameId);
    await fireEvent.press(screen.getByTestId(testId(gameId, 'start')));
    const advance = async (ms: number) => {
      await act(async () => {
        clock.advance(ms);
        jest.advanceTimersByTime(ms);
      });
    };
    if (toAnswerPhase) await toAnswerPhase(advance);
    await expectCountdownLifecycle({ gameId, advance, elapsedMs });
  } finally {
    jest.useRealTimers();
  }
}
