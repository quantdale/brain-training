import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { flexibilityGameReducer as reduce } from '../reducer';
import { createInitialFlexibilityState, continuationStamp, GAME_ID } from '../types';
import type { FlexibilityGameState } from '../types';
import type { SessionPersistence } from '../session';
import { flexibilityParamsFromProfile } from '../difficulty';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

const SEED = '077-rendered-input';
function start(): FlexibilityGameState {
  return reduce(createInitialFlexibilityState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0,
  });
}
function finish(current: FlexibilityGameState) {
  return reduce(current, { type: 'pick-card', index: current.round!.correctIndex, responseMs: 0 });
}
function next(current: FlexibilityGameState) {
  return reduce(current, { type: 'next-round', stamp: continuationStamp(current) });
}
async function press(part: string) {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, part)));
}
// Retain the exact native caller, rather than rediscovering a fresh callback
// through fireEvent after the screen has replaced its displayed cue.
function capture(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') return onPress as () => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual press callback: ' + part);
}
async function renderGame() {
  const clock = createFakeClock(0);
  const tutorialStore = createInMemoryTutorialStore();
  tutorialStore.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const persistSession: SessionPersistence = {
    completeSession: jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
    })),
  };
  await render(<GameScreen clock={clock} tutorialStore={tutorialStore} sessionSeed={SEED} persistSession={persistSession} />);
  await press('start');
  return clock;
}
function answerPart(current: FlexibilityGameState) {
  return 'card-grid.card.' + current.round!.correctIndex;
}
function sensoryCount(spy: { mock: { calls: readonly (readonly unknown[])[] } }) {
  return spy.mock.calls.filter(([event]) => typeof event === 'string' && /flexibility-(?:card|cue)-(?:correct|wrong)/.test(event)).length;
}
describe('rendered answer ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('claims one scored answer and one feedback event before another native callback in the same batch', async () => {
    await renderGame();
    const answer = capture(answerPart(start()));
    const spy = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { answer(); answer(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(sensoryCount(spy)).toBe(1);
  });

  it('retires an old displayed cue after Next while a fresh choice on the next cue still works', async () => {
    await renderGame();
    const first = start();
    const answer = capture(answerPart(first));
    await act(async () => answer());
    await press('next-round');
    const spy = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => answer());
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(sensoryCount(spy)).toBe(0);
    await press(answerPart(next(finish(first))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(sensoryCount(spy)).toBe(1);
  });

  it('rejects the old callback both during pause and after a same-batch resume, then accepts a fresh choice', async () => {
    const clock = await renderGame();
    const answer = capture(answerPart(start()));
    const pause = capture('pause');
    const spy = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { clock.advance(300); pause(); answer(); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    expect(sensoryCount(spy)).toBe(0);
    const resume = capture('resume');
    await act(async () => { clock.advance(5000); resume(); answer(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(sensoryCount(spy)).toBe(0);
    await press(answerPart(start()));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(sensoryCount(spy)).toBe(1);
  });

  it('does not let an abandoned session answer emit feedback', async () => {
    await renderGame();
    const answer = capture(answerPart(start()));
    await press('pause');
    const quit = capture('quit');
    const spy = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { quit(); answer(); });
    expect(sensoryCount(spy)).toBe(0);
  });

  it('retires an earlier session callback even when a restart displays its identical seeded first cue', async () => {
    await renderGame();
    const answer = capture(answerPart(start()));
    await press('qa-toggle');
    await press('force-win');
    await press('restart');
    const spy = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => answer());
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(sensoryCount(spy)).toBe(0);
    await press(answerPart(start()));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
  });

  it('retires the displayed rule-switch Continue through pause and resume', async () => {
    await renderGame();
    let oracle = start();
    while (oracle.phase !== 'ruleSwitchNotice') {
      await press(answerPart(oracle));
      await press('next-round');
      oracle = next(finish(oracle));
    }
    const old = capture('switch-notice-continue');
    await press('pause');
    const resume = capture('resume');
    await act(async () => { resume(); old(); });
    expect(screen.getByTestId(testId(GAME_ID, 'switch-notice-continue'))).toBeOnTheScreen();
    await press('switch-notice-continue');
    expect(screen.getByTestId(testId(GAME_ID, 'card-grid'))).toBeOnTheScreen();
  });

  it('drops a cancelled notice timer even if its native callback is delivered after resume', async () => {
    await renderGame();
    const timers = jest.spyOn(global, 'setTimeout');
    let oracle = start();
    const noticeMs = flexibilityParamsFromProfile(oracle.profile!).noticeMs;
    while (oracle.phase !== 'ruleSwitchNotice') {
      await press(answerPart(oracle));
      await press('next-round');
      oracle = next(finish(oracle));
    }
    const pending = timers.mock.calls.filter(([, delay]) => delay === noticeMs).at(-1)![0] as () => void;
    await press('pause');
    await press('resume');
    await act(async () => pending());
    expect(screen.getByTestId(testId(GAME_ID, 'switch-notice-continue'))).toBeOnTheScreen();
    await press('switch-notice-continue');
    expect(screen.getByTestId(testId(GAME_ID, 'card-grid'))).toBeOnTheScreen();
  });
});
