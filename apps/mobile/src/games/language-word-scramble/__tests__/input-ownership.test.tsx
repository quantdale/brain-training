import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { wordScrambleGameReducer as reduce } from '../reducer';
import { createInitialWordScrambleState, continuationStamp, GAME_ID } from '../types';
import type { WordScrambleGameState } from '../types';
import type { SessionPersistence } from '../session';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
const SEED = '077-math-word-input';
function start(): WordScrambleGameState {
  return reduce(createInitialWordScrambleState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0,
  });
}
function finish(current: WordScrambleGameState): WordScrambleGameState {
  current = reduce(current, { type: 'select-option', index: current.currentRound!.correctIndex }); return reduce(current, { type: 'submit-answer' });
}
function next(current: WordScrambleGameState): WordScrambleGameState { return reduce(current, { type: 'next-round', stamp: continuationStamp(current) }); }
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
async function play(current = start()) { await press('option.' + current.currentRound!.correctIndex); await press('submit'); }
function inputPart(current = start()) { return 'option.' + current.currentRound!.correctIndex; }
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
    expect(screen.getByTestId(testId(GAME_ID, 'submit')).props.accessibilityState.disabled).toBe(true);
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
    expect(screen.getByTestId(testId(GAME_ID, 'submit')).props.accessibilityState.disabled).toBe(true);
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });

  it('retires the previous session even when its first seeded cue reappears on restart', async () => {
    await renderGame();
    const old = capture(inputPart());
    await press('qa-toggle'); await press('force-win'); await press('restart');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => old(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'submit')).props.accessibilityState.disabled).toBe(true);
    expect(feedback).not.toHaveBeenCalled();
    await play();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });
  it('keeps one physical choice delivery from replacing the staged option', async () => {
    await renderGame();
    const choice = capture('option.0');
    const other = capture('option.1');
    const event = nativeInput();
    await act(async () => { choice(event); other(event); });
    expect(screen.getByTestId(testId(GAME_ID, 'option', '0')).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(testId(GAME_ID, 'option', '1')).props.accessibilityState.selected).toBe(false);
    await act(async () => other(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'option', '1')).props.accessibilityState.selected).toBe(true);
  });

  it('submits a same-batch staged choice exactly once', async () => {
    await renderGame();
    const choice = capture(inputPart());
    const submit = capture('submit');
    const feedback = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { choice(nativeInput()); submit(nativeInput()); submit(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
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

});
