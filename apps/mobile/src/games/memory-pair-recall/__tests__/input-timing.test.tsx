import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import PairRecallScreen from '../screen';
import { pairRecallGameReducer } from '../reducer';
import { PAIR_RECALL_DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID, createInitialPairRecallState, inputStamp } from '../types';

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
  return pairRecallGameReducer(createInitialPairRecallState(), { type: 'start-session', seed: '077-pair', sessionId: '077', startedAtMs: 0, nowMs: 0 });
}

function recall() {
  const state = start();
  return pairRecallGameReducer(state, { type: 'study-tick', nowMs: state.studyDeadlineMs, stamp: inputStamp(state) });
}

async function renderRecall() {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  await render(<PairRecallScreen clock={clock} tutorialStore={store} sessionSeed="077-pair" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const studyMs = PAIR_RECALL_DIFFICULTY_PARAMS.normal.studyMs;
  await act(async () => { clock.advance(studyMs); jest.advanceTimersByTime(studyMs); });
  return clock;
}

describe('Pair Recall rendered cue input', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('does not replay a stamped response against the unseen next cue', () => {
    const state = recall();
    const responseId = state.round!.pairs[state.round!.cueOrder[0]].responseId;
    const action = { type: 'respond' as const, responseId, stamp: inputStamp(state) };
    const first = pairRecallGameReducer(state, action);
    expect(first.cueIndex).toBe(1);
    expect(pairRecallGameReducer(first, action)).toBe(first);
  });

  it('keeps study visible until its absolute deadline and rejects the old study callback after recall', () => {
    const state = start();
    const action = { type: 'study-tick' as const, nowMs: state.studyDeadlineMs, stamp: inputStamp(state) };
    expect(pairRecallGameReducer(state, { ...action, nowMs: state.studyDeadlineMs - 1 })).toBe(state);
    const recalled = pairRecallGameReducer(state, action);
    expect(recalled.phase).toBe('recall');
    expect(pairRecallGameReducer(recalled, action)).toBe(recalled);
  });

  it('preserves the exact study remainder and invalidates pre-pause callbacks', () => {
    const state = start();
    const stamp = inputStamp(state);
    const paused = pairRecallGameReducer(state, { type: 'pause', nowMs: 100 });
    const resumed = pairRecallGameReducer(paused, { type: 'resume', nowMs: 10100 });
    expect(resumed.studyDeadlineMs).toBe(state.studyDeadlineMs + 10000);
    expect(pairRecallGameReducer(resumed, { type: 'study-tick', nowMs: resumed.studyDeadlineMs, stamp })).toBe(resumed);
    expect(pairRecallGameReducer(resumed, { type: 'study-tick', nowMs: resumed.studyDeadlineMs, stamp: inputStamp(resumed) }).phase).toBe('recall');
  });

  it('rejects responses from an earlier pause epoch or session, then accepts a fresh cue', () => {
    const state = recall();
    const responseId = state.round!.pairs[state.round!.cueOrder[0]].responseId;
    const action = { type: 'respond' as const, responseId, stamp: inputStamp(state) };
    const paused = pairRecallGameReducer(state, { type: 'pause', nowMs: state.studyDeadlineMs });
    const resumed = pairRecallGameReducer(paused, { type: 'resume', nowMs: state.studyDeadlineMs + 10000 });
    expect(pairRecallGameReducer(resumed, action)).toBe(resumed);
    expect(pairRecallGameReducer(resumed, { ...action, stamp: { ...inputStamp(resumed), sessionId: 'older-session' } })).toBe(resumed);
    expect(pairRecallGameReducer(resumed, { ...action, stamp: inputStamp(resumed) }).cueIndex).toBe(1);
  });

  it('counts only one delivered response before React renders the next cue', async () => {
    await renderRecall();
    const state = recall();
    const responseId = state.round!.pairs[state.round!.cueOrder[0]].responseId;
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    const oldPress = capturePress(testId(GAME_ID, 'response', String(responseId)));
    await act(async () => {
      oldPress();
      oldPress();
    });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^Cue 2 of /);
    expect(feedback).toHaveBeenCalledTimes(1);

    // A genuinely new rendered cue is immediately answerable at the same
    // clock value; the guard is cue identity, not a time-based debounce.
    const nextResponseId = state.round!.pairs[state.round!.cueOrder[1]].responseId;
    await act(async () => { oldPress(); });
    expect(feedback).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'response', String(nextResponseId))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^Cue 3 of /);
    expect(feedback).toHaveBeenCalledTimes(2);
  });

  it('keeps a queued response from before pause silent after resume', async () => {
    const clock = await renderRecall();
    const state = recall();
    const responseId = state.round!.pairs[state.round!.cueOrder[0]].responseId;
    const oldPress = capturePress(testId(GAME_ID, 'response', String(responseId)));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { oldPress(); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^Cue 1 of /);
    expect(feedback).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'response', String(responseId))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^Cue 2 of /);
  });
});
