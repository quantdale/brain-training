import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import { oddOneOutReducer } from '../reducer';
import OddOneOutScreen from '../screen';
import type { OddOneOutScreenProps } from '../screen';
import { Tutorial, TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateBoard } from '../generator';
import { GAME_ID, createInitialOddOneOutState, inputStamp } from '../types';
import type { OddOneOutRawResult } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

/** Capture the same rendered press handler that fireEvent reaches through RN's responder wrapper. */
function capturePress(id: string): () => void {
  let fiber = screen.getByTestId(id).unstable_fiber;
  while (fiber !== null) {
    const handler = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler;
    fiber = fiber.return;
  }
  throw new Error(`Missing press handler: ${id}`);
}

function start() {
  return oddOneOutReducer(createInitialOddOneOutState(), { type: 'start-session', seed: '077-odd', sessionId: '077', startedAtMs: 0, nowMs: 0 });
}

async function renderPlaying() {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(createElement<OddOneOutScreenProps>(OddOneOutScreen, { clock, tutorialStore: store, sessionSeed: '077-odd', persistSession: { completeSession } }));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return { clock, completeSession };
}

describe('Odd One Out active clock', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('gives the same solve ratio after a long pause as for 200 ms of active play', () => {
    const original = start();
    const paused = oddOneOutReducer(original, { type: 'pause', nowMs: 100 });
    const resumed = oddOneOutReducer(paused, { type: 'resume', nowMs: 10100 });
    const action = { type: 'tap-tile' as const, index: original.board!.oddIndex, nowMs: 10200, stamp: inputStamp(resumed) };
    const after = oddOneOutReducer(resumed, action);
    expect(after.stats.solveRatioSum).toBeCloseTo(200 / original.windowMs);
  });

  it('does not accept a correct tap exactly at the deadline', () => {
    const state = start();
    const action = { type: 'tap-tile' as const, index: state.board!.oddIndex, nowMs: state.deadlineMs, stamp: inputStamp(state) };
    expect(oddOneOutReducer(state, action)).toBe(state);
    expect(oddOneOutReducer(state, { ...action, nowMs: state.deadlineMs - 1 }).roundOutcome).toBe('passed');
  });

  it('rejects stale taps and timeouts after pause or round advance', () => {
    const state = start();
    const tap = { type: 'tap-tile' as const, index: state.board!.oddIndex, nowMs: 100, stamp: inputStamp(state) };
    const paused = oddOneOutReducer(state, { type: 'pause', nowMs: 100 });
    const resumed = oddOneOutReducer(paused, { type: 'resume', nowMs: 10100 });
    expect(oddOneOutReducer(resumed, { ...tap, nowMs: 10200 })).toBe(resumed);
    expect(oddOneOutReducer(resumed, { type: 'round-timeout', nowMs: resumed.deadlineMs, stamp: tap.stamp })).toBe(resumed);
    const passed = oddOneOutReducer(resumed, { ...tap, nowMs: 10200, stamp: inputStamp(resumed) });
    const next = oddOneOutReducer(passed, { type: 'next-round', nowMs: 10200, stamp: inputStamp(passed) });
    expect(oddOneOutReducer(next, { type: 'round-timeout', nowMs: 50000, stamp: inputStamp(resumed) })).toBe(next);
    expect(oddOneOutReducer(next, { type: 'round-timeout', nowMs: next.deadlineMs - 1, stamp: inputStamp(next) })).toBe(next);
  });

  it('keeps fast distinct native taps valid and repeated completion delivery silent', async () => {
    await renderPlaying();
    const state = start();
    const wrongPress = capturePress(testId(GAME_ID, 'tile', String((state.board!.oddIndex + 1) % state.gridSize)));
    const oldCorrect = capturePress(testId(GAME_ID, 'tile', String(state.board!.oddIndex)));
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { wrongPress(); oldCorrect(); oldCorrect(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(feedback.mock.calls).toEqual([['odd-one-out-wrong'], ['odd-one-out-correct']]);
    const oldNext = capturePress(testId(GAME_ID, 'next-round'));
    await act(async () => { oldNext(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await act(async () => { oldCorrect(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-passed'))).toBeNull();
    expect(feedback).toHaveBeenCalledTimes(2);
  });

  it('persists the same active solve ratios when a native session includes a long pause', async () => {
    const { clock, completeSession } = await renderPlaying();
    let state = start();
    const stalePress = capturePress(testId(GAME_ID, 'tile', String(state.board!.oddIndex)));
    clock.advance(100);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    clock.advance(100);
    await act(async () => { stalePress(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-passed'))).toBeNull();

    // Finish the real six-round flow so the timing assertion reaches the
    // persisted raw result rather than a screen-local speed approximation.
    for (let round = 0; round < 6; round += 1) {
      if (round > 0) clock.advance(200);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(state.board!.oddIndex))));
      state = oddOneOutReducer(state, { type: 'tap-tile', index: state.board!.oddIndex, nowMs: state.roundStartedAtMs + 200, stamp: inputStamp(state) });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      state = oddOneOutReducer(state, { type: 'next-round', nowMs: clock.now(), stamp: inputStamp(state) });
    }
    await act(async () => {});
    expect(completeSession).toHaveBeenCalledTimes(1);
    const session = completeSession.mock.calls[0][0].session;
    const raw = session.rawResult as OddOneOutRawResult;
    expect(raw.avgSolveRatio).toBeCloseTo((200 / 12000 + 200 / 10500 + 4 * 200 / 9000) / 6, 8);
    expect(session.durationMs).toBe(1200);
  });

  it('does not let queued tutorial taps solve the replay of a failed attempt', async () => {
    await render(createElement(Tutorial, { onComplete: jest.fn() }));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const board = generateBoard({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, subtlety: 0, gridSize: 9, prevBoard: null });
    const wrongPress = capturePress(testId(GAME_ID, 'tile', String((board.oddIndex + 1) % 9)));
    const oldCorrect = capturePress(testId(GAME_ID, 'tile', String(board.oddIndex)));
    await act(async () => { wrongPress(); oldCorrect(); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(board.oddIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });
});
