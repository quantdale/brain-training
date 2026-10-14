import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import TargetCountScreen from '../screen';
import { targetCountGameReducer } from '../reducer';
import { GAME_ID, createInitialTargetCountState, inputStamp } from '../types';
import { roundScore } from '../scoring';

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
  const action = { type: 'start-session' as const, seed: '077-count', sessionId: '077', startedAtMs: 0, nowMs: 0 };
  return targetCountGameReducer(createInitialTargetCountState(), action);
}

async function renderPlaying() {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  await render(<TargetCountScreen clock={clock} tutorialStore={store} sessionSeed="077-count" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return clock;
}

describe('Target Count actual deadline', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each([9000, 9001])('classifies a correct answer at %i ms as a timeout', (nowMs) => {
    const state = start();
    const action = { type: 'answer' as const, selectedCount: state.currentRound!.targetCount, nowMs, stamp: inputStamp(state) };
    const after = targetCountGameReducer(state, action);
    expect(after.roundOutcome).toBe('timeout');
    expect(after.selectedCount).toBeNull();
    expect(after.stats.totalElapsedMs).toBe(9000);
    expect(after.stats.roundsCorrect).toBe(0);
  });

  it('measures actual elapsed clock time instead of trusting a stale fixed-step accumulator', () => {
    const state = start();
    const action = { type: 'answer' as const, selectedCount: state.currentRound!.targetCount, nowMs: 1000, stamp: inputStamp(state) };
    const after = targetCountGameReducer(state, action);
    expect(after.roundOutcome).toBe('correct');
    expect(after.stats.totalElapsedMs).toBe(1000);
  });

  it('accepts the final in-window millisecond and ignores an early timeout callback', () => {
    const state = start();
    const action = { type: 'answer' as const, selectedCount: state.currentRound!.targetCount, nowMs: 8999, stamp: inputStamp(state) };
    expect(targetCountGameReducer(state, action).roundOutcome).toBe('correct');
    expect(targetCountGameReducer(state, { ...action, selectedCount: null })).toBe(state);
  });

  it('excludes repeated pause spans from elapsed time and rejects earlier epochs', () => {
    const state = start();
    const stale = { type: 'answer' as const, selectedCount: state.currentRound!.targetCount, nowMs: 10300, stamp: inputStamp(state) };
    let current = targetCountGameReducer(state, { type: 'pause', nowMs: 100 });
    current = targetCountGameReducer(current, { type: 'resume', nowMs: 10100 });
    current = targetCountGameReducer(current, { type: 'pause', nowMs: 10200 });
    current = targetCountGameReducer(current, { type: 'resume', nowMs: 20200 });
    expect(targetCountGameReducer(current, stale)).toBe(current);
    const after = targetCountGameReducer(current, { ...stale, nowMs: 20300, stamp: inputStamp(current) });
    expect(after.stats.totalElapsedMs).toBe(300);
    expect(after.roundOutcome).toBe('correct');
  });

  it('does not replay a timer or answer into the next round or a restarted session', () => {
    const state = start();
    const oldAnswer = { type: 'answer' as const, selectedCount: state.currentRound!.targetCount, nowMs: 0, stamp: inputStamp(state) };
    const scored = targetCountGameReducer(state, oldAnswer);
    const next = targetCountGameReducer(scored, { type: 'next-round', nowMs: 0, stamp: inputStamp(scored) });
    expect(targetCountGameReducer(next, oldAnswer)).toBe(next);
    expect(targetCountGameReducer(next, { ...oldAnswer, selectedCount: null, nowMs: 10000 })).toBe(next);
    const restarted = targetCountGameReducer(next, { type: 'start-session', seed: '077-count', sessionId: 'new-session', startedAtMs: 0, nowMs: 0 });
    expect(targetCountGameReducer(restarted, oldAnswer)).toBe(restarted);
  });

  it('rejects a late correct native press before the pending timer callback runs', async () => {
    const clock = await renderPlaying();
    await act(async () => { clock.advance(9001); });
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(start().currentRound!.targetCount))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(feedback).not.toHaveBeenCalled();
  });

  it('measures a native answer between timer polls and counts duplicate delivery once', async () => {
    const clock = await renderPlaying();
    clock.advance(1000);
    const oldPress = capturePress(testId(GAME_ID, 'count-option', String(start().currentRound!.targetCount)));
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { oldPress(); oldPress(); });
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(`Score ${Math.round(roundScore(true, 9000, 1000))}`);
    expect(feedback).toHaveBeenCalledTimes(1);
    const oldNext = capturePress(testId(GAME_ID, 'next-round'));
    await act(async () => { oldNext(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await act(async () => { oldPress(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-correct'))).toBeNull();
    expect(feedback).toHaveBeenCalledTimes(1);
    const initial = start();
    const scored = targetCountGameReducer(initial, { type: 'answer', selectedCount: initial.currentRound!.targetCount, nowMs: 1000, stamp: inputStamp(initial) });
    const next = targetCountGameReducer(scored, { type: 'next-round', nowMs: 1000, stamp: inputStamp(scored) });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(next.currentRound!.targetCount))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(feedback).toHaveBeenCalledTimes(2);
  });

  it('accepts a fresh native answer after pause using only active time', async () => {
    const clock = await renderPlaying();
    const id = testId(GAME_ID, 'count-option', String(start().currentRound!.targetCount));
    const oldPress = capturePress(id);
    clock.advance(100);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    clock.advance(100);
    await act(async () => { oldPress(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-correct'))).toBeNull();
    await fireEvent.press(screen.getByTestId(id));
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(`Score ${Math.round(roundScore(true, 9000, 200))}`);
  });
});
