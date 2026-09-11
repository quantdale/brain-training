/**
 * Late-tap feedback regression (Campaign 023 KNOWN_ISSUES → 024 micro R2).
 *
 * Tap feedback used to fire from the tap handler's optimism (index matched
 * the target) BEFORE the reducer's post-deadline guard resolved, so a tap
 * landing inside the scheduling gap — after the window, before the next tick
 * — sounded a hit while the round scored a timeout. Feedback now derives
 * from the reducer's authoritative resolution.
 *
 * The "stays silent" test fails on the old behaviour: the old handler played
 * the hit sound unconditionally for a target tap, while the timeout
 * resolution (unchanged scoring) still holds.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  liveAudioHaptics,
  testId,
} from '@/sdk';
import type { FakeClock } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { VISUAL_SEARCH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSessionTargets } from '../generator';
import VisualSearchScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

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

async function renderScreen(options: { seed?: string; clock?: FakeClock } = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const result = await render(
    <VisualSearchScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={options.seed ?? 'late-tap-seed'}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** Advance both the fake lifecycle clock and the tick timers. */
async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('VisualSearchScreen late-tap feedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a post-deadline tap on the target stays silent while the round times out', async () => {
    const seed = 'late-tap-silent';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // normal round 1: 4.5s window on a 120s session budget.
    const target = generateSessionTargets(seed, VISUAL_SEARCH_DIFFICULTY_PARAMS.normal)[0];

    // Advance the monotonic clock past the window WITHOUT firing the tick
    // interval: this is the scheduling gap (the tap lands after the window,
    // before the next tick resolves the timeout).
    await act(async () => {
      clock.advance(4_500 + 500);
    });

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    const haptic = jest.spyOn(liveAudioHaptics, 'haptic');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(target))));

    // The reducer resolved the tap as a timeout, so no hit/miss feedback may
    // fire — the old handler sounded a hit here. Fails on old behaviour.
    expect(playSfx).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    // Unlike the tick-driven games, this reducer resolves the late tap to a
    // timeout synchronously: the round result is already the timeout verdict
    // (scoring unchanged), with no scheduling gap left behind.
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'fail-reason'))).toHaveTextContent(/Time's up/);
  });

  it('an in-window tap on the target still sounds a hit', async () => {
    const seed = 'late-tap-control';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const target = generateSessionTargets(seed, VISUAL_SEARCH_DIFFICULTY_PARAMS.normal)[0];

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    await advanceTime(clock, 1_000);
    playSfx.mockClear();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(target))));

    // Authoritative outcome is a pass, so the hit feedback still fires.
    expect(playSfx).toHaveBeenCalledWith('visual-search-hit');
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });
});
