import { budgetForRound, mathMissingOperatorParamsFromProfile } from '../difficulty';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { mathMissingOperatorGameReducer as reduce } from '../reducer';
import { createInitialMathMissingOperatorState, continuationStamp, GAME_ID } from '../types';
import type { MathMissingOperatorGameState } from '../types';
import type { SessionPersistence } from '../session';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
const SEED = '077-math-word-input';
function start(): MathMissingOperatorGameState {
  return reduce(createInitialMathMissingOperatorState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0, roundStartedAtMs: 0,
  });
}
function finish(current: MathMissingOperatorGameState): MathMissingOperatorGameState {
  return reduce(current, { type: 'answer-round', operator: current.equation!.answerOperator, responseMs: 0 });
}
function next(current: MathMissingOperatorGameState): MathMissingOperatorGameState { return reduce(current, { type: 'next-round', roundStartedAtMs: 0, stamp: continuationStamp(current) }); }
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
async function play(current = start()) { await press('op.' + current.equation!.answerOperator); }
function inputPart(current = start()) { return 'op.' + current.equation!.answerOperator; }
describe('rendered input ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('retires an earlier displayed cue before a fresh choice on the next cue', async () => {
    await renderGame();
    const old = capture(inputPart());
    await play();
    await press('next-round');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
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
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => old(nativeInput()));
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(feedback).not.toHaveBeenCalled();
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });
  it('claims a same-batch answer before duplicate verdict feedback', async () => {
    await renderGame();
    const answer = capture(inputPart());
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { answer(nativeInput()); answer(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it('resolves an overdue answer as timeout without an optimistic verdict sound', async () => {
    const clock = await renderGame();
    const answer = capture(inputPart());
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { clock.advance(100_000); answer(nativeInput()); });
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
    const scheduled = timers.mock.calls.find(([, delay]) => delay === budgetForRound(mathMissingOperatorParamsFromProfile(start().profile!), 0)!);
    expect(scheduled).toBeDefined();
    const wake = scheduled![0] as () => void;
    await play();
    await press('next-round');
    await act(async () => { clock.advance(100_000); wake(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
  });

});
