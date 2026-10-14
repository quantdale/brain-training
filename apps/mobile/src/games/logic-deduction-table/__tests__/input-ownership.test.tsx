import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { logicDeductionReducer as reduce } from '../reducer';
import { createInitialLogicDeductionState, GAME_ID } from '../types';
import type { LogicDeductionState } from '../types';
import type { SessionPersistence } from '../session';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
const SEED = '077-math-word-input';
function start(): LogicDeductionState {
  return reduce(createInitialLogicDeductionState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0, nowMs: 0,
  });
}
function finish(current: LogicDeductionState): LogicDeductionState {
  return reduce(current, { type: 'answer-option', index: current.round!.correctIndex, nowMs: 0 });
}
function next(current: LogicDeductionState): LogicDeductionState {
  return reduce(current, { type: 'next-round', nowMs: 0 });
}
async function press(part: string) { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part))); }
function capture(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') return onPress as (event?: GestureResponderEvent) => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual native callback: ' + part);
}
function nativeInput() { return { nativeEvent: {} } as GestureResponderEvent; }
async function renderGame(autoStart = true) {
  const clock = createFakeClock(0);
  const tutorialStore = createInMemoryTutorialStore();
  tutorialStore.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const persistSession: SessionPersistence = {
    completeSession: jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
    })),
  };
  await render(<GameScreen clock={clock} tutorialStore={tutorialStore} sessionSeed={SEED} persistSession={persistSession} />);
  if (autoStart) await press('start');
  return clock;
}
async function play(current = start()) { await press('option.' + current.round!.correctIndex); }
function inputPart(current = start()) { return 'option.' + current.round!.correctIndex; }
describe('rendered input ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('retires an earlier displayed cue before a fresh choice on the next cue', async () => {
    await renderGame();
    const old = capture(inputPart());
    await play();
    await press('next-round');
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => old(nativeInput()));
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(feedback).not.toHaveBeenCalled();
    await play(next(finish(start())));
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });

  it('retires input through same-batch pause/resume while accepting a fresh choice', async () => {
    await renderGame();
    const old = capture(inputPart());
    const pause = capture('pause');
    await act(async () => { pause(); old(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    const resume = capture('resume');
    await act(async () => { resume(); old(nativeInput()); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });

  it('retires the previous session even when its first seeded cue reappears on restart', async () => {
    await renderGame();
    const old = capture(inputPart());
    await press('qa-toggle'); await press('force-win'); await press('restart');
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => old(nativeInput()));
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(feedback).not.toHaveBeenCalled();
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });
  it('claims the round before duplicate answer feedback', async () => {
    await renderGame();
    const answer = capture(inputPart());
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { answer(nativeInput()); answer(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1])('resolves an answer at deadline + %d ms as timeout without an optimistic verdict', async (offset) => {
    const clock = await renderGame();
    const answer = capture(inputPart());
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { clock.advance(start().roundDeadlineMs! + offset); answer(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(feedback).not.toHaveBeenCalled();
  });

  it('retires the intro Start callback after completion while allowing a fresh restart', async () => {
    await renderGame(false);
    const oldStart = capture('start');
    await press('start'); await press('qa-toggle'); await press('force-win');
    await act(async () => oldStart());
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await press('restart');
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
  });

  it('claims Help before a same-batch retained Start can begin underneath it', async () => {
    await renderGame(false);
    const help = capture('help');
    const startGame = capture('start');
    await act(async () => { help(); startGame(); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await press('tutorial-skip');
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    await press('start');
    expect(screen.queryByTestId(testId(GAME_ID, 'intro'))).toBeNull();
  });

  it('retires a queued timer wake before the next displayed cue', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await renderGame();
    const scheduled = timers.mock.calls.find(([, delay]) => delay === start().roundDeadlineMs!);
    expect(scheduled).toBeDefined();
    const wake = scheduled![0] as () => void;
    await play();
    await press('next-round');
    await act(async () => { clock.advance(100_000); wake(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
  });

});
