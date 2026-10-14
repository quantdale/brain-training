import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { mathGameReducer as reduce } from '../reducer';
import { createInitialMathState, continuationStamp, GAME_ID } from '../types';
import type { MathGameState } from '../types';
import type { SessionPersistence } from '../session';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
const SEED = '077-math-word-input';
function start(): MathGameState {
  return reduce(createInitialMathState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0,
  });
}
function finish(current: MathGameState): MathGameState {
  for (const d of String(current.problem!.answer)) current = reduce(current, { type: 'digit', digit: Number(d) });
  return reduce(current, { type: 'submit-answer', atActiveMs: 0 });
}
function next(current: MathGameState): MathGameState { return reduce(current, { type: 'next-problem', startedAtActiveMs: 0, stamp: continuationStamp(current) }); }
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
async function play(current = start()) { for (const d of String(current.problem!.answer)) await press('digit.' + d);
  await press('submit'); }
function inputPart() { return 'digit.1'; }
describe('rendered input ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('retires an earlier displayed cue before a fresh choice on the next cue', async () => {
    await renderGame();
    const old = capture(inputPart());
    await play();
    await press('next-problem');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => old(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent(/^\?$/);
    expect(feedback).not.toHaveBeenCalled();
    await play(next(finish(start())));
    expect(screen.getByTestId(testId(GAME_ID, 'next-problem'))).toBeOnTheScreen();
  });

  it('retires input through same-batch pause/resume while accepting a fresh choice', async () => {
    await renderGame();
    const old = capture(inputPart());
    const pause = capture('pause');
    await act(async () => { pause(); old(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    const resume = capture('resume');
    await act(async () => { resume(); old(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent(/^\?$/);
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-problem'))).toBeOnTheScreen();
  });

  it('retires the previous session even when its first seeded cue reappears on restart', async () => {
    await renderGame();
    const old = capture(inputPart());
    await press('qa-toggle'); await press('force-win'); await press('restart');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => old(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent(/^\?$/);
    expect(feedback).not.toHaveBeenCalled();
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-problem'))).toBeOnTheScreen();
  });
  it('accepts distinct repeated digits but consumes one physical delivery once', async () => {
    await renderGame();
    const digit = capture('digit.1');
    const event = nativeInput();
    await act(async () => { digit(event); digit(event); });
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent(/^1$/);
    await act(async () => digit(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent(/^11$/);
  });

  it('stages rapid distinct digits before a same-batch submit with one verdict', async () => {
    await renderGame();
    const digits = String(start().problem!.answer).split('').map(d => capture('digit.' + d));
    const submit = capture('submit');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { digits.forEach(digit => digit(nativeInput())); submit(nativeInput()); submit(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'feedback-correct'))).toBeOnTheScreen();
    expect(feedback).toHaveBeenCalledTimes(1);
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
    const timers = jest.spyOn(global, 'setInterval');
    const clock = await renderGame();
    const scheduled = timers.mock.calls.find(([, delay]) => delay === 100);
    expect(scheduled).toBeDefined();
    const wake = scheduled![0] as () => void;
    await play();
    await press('next-problem');
    await act(async () => { clock.advance(100_000); wake(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'feedback-timeout'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'next-problem'))).toBeNull();
  });

});
