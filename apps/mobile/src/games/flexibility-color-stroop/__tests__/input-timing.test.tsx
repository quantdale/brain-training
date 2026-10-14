import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import ColorStroopScreen from '../screen';
import { colorStroopGameReducer } from '../reducer';
import { GAME_ID, createInitialColorStroopState, inputStamp } from '../types';

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
  const action = { type: 'start-session' as const, seed: '077-stroop', sessionId: '077', startedAtMs: 0, nowMs: 0 };
  return colorStroopGameReducer(createInitialColorStroopState(), action);
}

async function renderPlaying() {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  await render(<ColorStroopScreen clock={clock} tutorialStore={store} sessionSeed="077-stroop" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return clock;
}

function flipCue() {
  let state = start();
  for (let trial = 0; trial < 4; trial += 1) {
    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: state.trials[trial].correctAnswer, nowMs: 0, stamp: inputStamp(state) });
    state = colorStroopGameReducer(state, { type: 'next-trial', nowMs: 0, stamp: inputStamp(state) });
  }
  return state;
}

describe('Color Stroop actual deadline', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each([1500, 1501])('classifies a correct answer at %i ms as a full-window timeout', (nowMs) => {
    const state = start();
    const action = { type: 'submit-answer' as const, answer: state.trials[0].correctAnswer, nowMs, stamp: inputStamp(state) };
    const next = colorStroopGameReducer(state, action);
    expect(next.currentAnswer).toBeNull();
    expect(next.currentCorrect).toBe(false);
    expect(next.currentResponseTimeMs).toBe(1500);
    expect(next.stats.correctTrials).toBe(0);
  });

  it('accepts the last in-window millisecond and rejects a premature timeout', () => {
    const state = start();
    expect(colorStroopGameReducer(state, { type: 'submit-answer', answer: state.trials[0].correctAnswer, nowMs: 1499, stamp: inputStamp(state) }).currentCorrect).toBe(true);
    expect(colorStroopGameReducer(state, { type: 'trial-timeout', nowMs: 1499, stamp: inputStamp(state) })).toBe(state);
  });

  it('excludes multiple pause spans from reaction time and invalidates older input epochs', () => {
    const state = start();
    const old = { type: 'submit-answer' as const, answer: state.trials[0].correctAnswer, nowMs: 20300, stamp: inputStamp(state) };
    let current = colorStroopGameReducer(state, { type: 'pause', nowMs: 100 });
    current = colorStroopGameReducer(current, { type: 'resume', nowMs: 10100 });
    current = colorStroopGameReducer(current, { type: 'pause', nowMs: 10200 });
    current = colorStroopGameReducer(current, { type: 'resume', nowMs: 20200 });
    expect(colorStroopGameReducer(current, old)).toBe(current);
    const answered = colorStroopGameReducer(current, { ...old, stamp: inputStamp(current) });
    expect(answered.currentCorrect).toBe(true);
    expect(answered.currentResponseTimeMs).toBe(300);
  });

  it('does not apply a previous trial timer or response to a new trial or session', () => {
    const state = start();
    const oldAnswer = { type: 'submit-answer' as const, answer: state.trials[0].correctAnswer, nowMs: 0, stamp: inputStamp(state) };
    const scored = colorStroopGameReducer(state, oldAnswer);
    const next = colorStroopGameReducer(scored, { type: 'next-trial', nowMs: 0, stamp: inputStamp(scored) });
    expect(colorStroopGameReducer(next, oldAnswer)).toBe(next);
    expect(colorStroopGameReducer(next, { type: 'trial-timeout', nowMs: 5000, stamp: inputStamp(state) })).toBe(next);
    const restarted = colorStroopGameReducer(next, { type: 'start-session', seed: '077-stroop', sessionId: 'new-session', startedAtMs: 0, nowMs: 0 });
    expect(colorStroopGameReducer(restarted, oldAnswer)).toBe(restarted);
  });

  it('keeps the full active rule-flip cue budget and rejects a queued pre-pause dismissal', () => {
    const state = flipCue();
    expect(state.phase).toBe('flipCue');
    const old = { type: 'dismiss-flip-cue' as const, nowMs: state.deadlineMs, stamp: inputStamp(state) };
    expect(colorStroopGameReducer(state, { ...old, nowMs: 1499 })).toBe(state);
    const paused = colorStroopGameReducer(state, { type: 'pause', nowMs: 100 });
    const resumed = colorStroopGameReducer(paused, { type: 'resume', nowMs: 10100 });
    expect(resumed.deadlineMs).toBe(11500);
    expect(colorStroopGameReducer(resumed, { ...old, nowMs: 11500 })).toBe(resumed);
    const stimulus = colorStroopGameReducer(resumed, { ...old, nowMs: 11500, stamp: inputStamp(resumed) });
    expect(stimulus.phase).toBe('stimulus');
    expect(stimulus.roundStartedAtMs).toBe(11500);
    expect(stimulus.deadlineMs).toBe(13000);
  });

  it('keeps a late correct native press silent while showing timeout feedback', async () => {
    const clock = await renderPlaying();
    await act(async () => { clock.advance(1501); });
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, `answer-buttons-${start().trials[0].correctAnswer}`)));
    expect(screen.getByText("Time's up!")).toBeOnTheScreen();
    expect(feedback).not.toHaveBeenCalled();
  });

  it('counts a delivered native answer once, keeps stale callbacks silent, and permits the fresh next trial immediately', async () => {
    await renderPlaying();
    const trials = start().trials;
    const oldPress = capturePress(testId(GAME_ID, `answer-buttons-${trials[0].correctAnswer}`));
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { oldPress(); oldPress(); });
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0ms')).toBeOnTheScreen();
    const oldNext = capturePress(testId(GAME_ID, 'next-trial'));
    await act(async () => { oldNext(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'trial', '2'))).toBeOnTheScreen();
    await act(async () => { oldPress(); });
    expect(screen.queryByText('Correct!')).toBeNull();
    expect(feedback).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, `answer-buttons-${trials[1].correctAnswer}`)));
    expect(screen.getByText('Correct!')).toBeOnTheScreen();
    expect(feedback).toHaveBeenCalledTimes(2);
  });

  it('measures a fresh native response after pause against active time', async () => {
    const clock = await renderPlaying();
    const id = testId(GAME_ID, `answer-buttons-${start().trials[0].correctAnswer}`);
    const oldPress = capturePress(id);
    clock.advance(100);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    clock.advance(100);
    await act(async () => { oldPress(); });
    expect(screen.queryByText('Correct!')).toBeNull();
    await fireEvent.press(screen.getByTestId(id));
    expect(screen.getByText('200ms')).toBeOnTheScreen();
    expect(screen.getByText('Correct!')).toBeOnTheScreen();
  });

  it('rejects an old raw timeout wakeup while preserving the native flip-cue remainder', async () => {
    const clock = await renderPlaying();
    const scheduled = jest.spyOn(global, 'setTimeout');
    const trials = start().trials;
    for (let trial = 0; trial < 4; trial += 1) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, `answer-buttons-${trials[trial].correctAnswer}`)));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    }
    expect(screen.getByText('RULE CHANGE!')).toBeOnTheScreen();
    const oldWakeup = scheduled.mock.calls.filter(([, ms]) => ms === 1500).at(-1)![0] as () => void;
    await act(async () => { clock.advance(100); jest.advanceTimersByTime(100); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldWakeup(); });
    expect(screen.getByText('RULE CHANGE!')).toBeOnTheScreen();
    await act(async () => { clock.advance(1399); jest.advanceTimersByTime(1399); });
    expect(screen.getByText('RULE CHANGE!')).toBeOnTheScreen();
    await act(async () => { clock.advance(1); jest.advanceTimersByTime(1); });
    expect(screen.queryByText('RULE CHANGE!')).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'answer-buttons'))).toBeOnTheScreen();
  });
});
