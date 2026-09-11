/**
 * Late-tap feedback regression (Campaign 023 KNOWN_ISSUES → 024 micro R2).
 *
 * Tap feedback used to fire from the tap handler's optimism (index matched
 * the odd tile) BEFORE the reducer's post-deadline guard resolved, so a tap
 * landing inside the scheduling gap — after the deadline, before the next
 * countdown tick — sounded "correct" while the round scored a timeout.
 * Feedback now derives from the reducer's authoritative resolution.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  liveAudioHaptics,
  testId,
} from '@/sdk';
import type { FakeClock } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import {
  ODD_ONE_OUT_DIFFICULTY_PARAMS,
  effectiveParamsForStep,
} from '../difficulty';
import { generateBoard } from '../generator';
import OddOneOutScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { OddOneOutBoard } from '../types';

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

async function renderScreen(options: {
  seed?: string;
  clock?: FakeClock;
} = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const result = await render(
    <OddOneOutScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={options.seed ?? 'late-tap-seed'}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Replicate the reducer's round-0 board so the test knows the odd tile
 * (mirrors the escalation logic in difficulty.ts).
 */
function roundZeroBoard(seed: string): OddOneOutBoard {
  const params = ODD_ONE_OUT_DIFFICULTY_PARAMS.normal;
  const effective = effectiveParamsForStep(params, 0);
  return generateBoard({
    rng: createRng(seed),
    roundIndex: 0,
    subtlety: effective.subtlety,
    gridSize: effective.gridSize,
    prevBoard: null,
  });
}

describe('OddOneOutScreen late-tap feedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('a post-deadline tap on the odd tile stays silent while the round times out', async () => {
    const seed = 'late-tap-silent';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const oddIndex = roundZeroBoard(seed).oddIndex;

    // Advance the monotonic clock past the 12s round-1 window WITHOUT firing
    // the countdown interval: this is the scheduling gap (the tap lands after
    // the deadline, before the next tick resolves the timeout).
    await act(async () => {
      clock.advance(12_000 + 500);
    });

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    const haptic = jest.spyOn(liveAudioHaptics, 'haptic');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(oddIndex))));

    // The reducer ignored the tap (no state change), so no feedback may fire
    // — the old handler sounded "correct" here. Fails on old behaviour.
    expect(playSfx).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    // The round is still live until the pending tick resolves it.
    expect(screen.getByTestId(testId(GAME_ID, 'board'))).toBeOnTheScreen();

    // The pending tick resolves the round as a timeout (scoring unchanged).
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByText('The odd one is highlighted — it beat the clock this time.')).toBeOnTheScreen();
  });

  it('an in-window tap on the odd tile still sounds correct', async () => {
    const seed = 'late-tap-control';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const oddIndex = roundZeroBoard(seed).oddIndex;

    const playSfx = jest.spyOn(liveAudioHaptics, 'playSfx');
    await advanceTime(clock, 2_000);
    playSfx.mockClear();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(oddIndex))));

    // Authoritative outcome is a pass, so the correct feedback still fires.
    expect(playSfx).toHaveBeenCalledWith('odd-one-out-correct');
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });
});
