import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { flexibilityRuleFlipReducer as reduce } from '../reducer';
import { createInitialFlexibilityRuleFlipState, continuationStamp, GAME_ID } from '../types';
import type { FlexibilityRuleFlipGameState } from '../types';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

const SEED = '077-rendered-input';
function start(): FlexibilityRuleFlipGameState {
  return reduce(createInitialFlexibilityRuleFlipState(), {
    type: 'start-session', seed: SEED, sessionId: 'oracle', startedAtMs: 0,
  });
}
function finish(current: FlexibilityRuleFlipGameState) {
  return reduce(current, { type: 'pick-card', index: current.round!.correctIndex, responseMs: 0 });
}
function next(current: FlexibilityRuleFlipGameState) {
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
function answerPart(current: FlexibilityRuleFlipGameState) {
  return 'card-grid.card.' + current.round!.correctIndex;
}
function sensoryCount(spy: { mock: { calls: readonly (readonly unknown[])[] } }) {
  return spy.mock.calls.filter(([event]) => event === 'correct' || event === 'wrong').length;
}
describe('rendered answer ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('claims one scored answer and one feedback event before another native callback in the same batch', async () => {
    await renderGame();
    const answer = capture(answerPart(start()));
    const spy = jest.spyOn(liveAudioHaptics, 'feedback');
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
    const spy = jest.spyOn(liveAudioHaptics, 'feedback');
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
    const spy = jest.spyOn(liveAudioHaptics, 'feedback');
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
    const spy = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { quit(); answer(); });
    expect(sensoryCount(spy)).toBe(0);
  });

  it('retires an earlier session callback even when a restart displays its identical seeded first cue', async () => {
    await renderGame();
    const answer = capture(answerPart(start()));
    await press('qa-toggle');
    await press('force-win');
    await press('restart');
    const spy = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => answer());
    expect(screen.queryByTestId(testId(GAME_ID, 'next-round'))).toBeNull();
    expect(sensoryCount(spy)).toBe(0);
    await press(answerPart(start()));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
  });

  it('shows disabled readiness through the measured switch arm window, including a pause', async () => {
    const clock = await renderGame();
    let oracle = start();
    while (!oracle.round!.isSwitch) {
      await press(answerPart(oracle));
      await press('next-round');
      oracle = next(finish(oracle));
    }
    const card = () => screen.getByTestId(testId(GAME_ID, answerPart(oracle)));
    expect(card()).toBeDisabled();
    expect(screen.getByTestId(testId(GAME_ID, 'pick-status'))).toHaveTextContent(/Get ready/);
    await act(async () => { clock.advance(300); jest.advanceTimersByTime(300); });
    await press('pause');
    await act(async () => { clock.advance(5000); jest.advanceTimersByTime(5000); });
    await press('resume');
    expect(card()).toBeDisabled();
    await act(async () => { clock.advance(499); jest.advanceTimersByTime(499); });
    expect(card()).toBeDisabled();
    await act(async () => { clock.advance(1); jest.advanceTimersByTime(1); });
    expect(card()).toBeEnabled();
    expect(screen.getByTestId(testId(GAME_ID, 'pick-status'))).toHaveTextContent(/pick the matching card/);
    await press(answerPart(oracle));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
  });

  it('does not enable a switch early when its wake fires before the injected clock reaches the deadline', async () => {
    const clock = await renderGame();
    let oracle = start();
    while (!oracle.round!.isSwitch) {
      await press(answerPart(oracle));
      await press('next-round');
      oracle = next(finish(oracle));
    }
    await act(async () => { clock.advance(799); jest.advanceTimersByTime(800); });
    expect(screen.getByTestId(testId(GAME_ID, answerPart(oracle)))).toBeDisabled();
    await act(async () => { clock.advance(1); jest.advanceTimersByTime(1); });
    expect(screen.getByTestId(testId(GAME_ID, answerPart(oracle)))).toBeEnabled();
  });

  it('starts response timing at committed readiness after a stalled arm callback', async () => {
    const clock = await renderGame();
    let oracle = start();
    while (!oracle.round!.isSwitch) {
      await press(answerPart(oracle));
      await press('next-round');
      oracle = next(finish(oracle));
    }
    // The JS wake is delivered 1200ms late. Until that wake commits, the
    // player sees disabled choices, which must not become response time.
    await act(async () => { clock.advance(2000); jest.advanceTimersByTime(800); });
    expect(screen.getByTestId(testId(GAME_ID, answerPart(oracle)))).toBeEnabled();
    await act(async () => clock.advance(200));
    await press(answerPart(oracle));
    // 200 measured response ms earns 148 base/speed points. Preserve the
    // independent existing +20 switch and +30 uncued-correct bonuses.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
      'Score ' + (oracle.stats.score + 148 + 20 + (oracle.round!.uncued ? 30 : 0)),
    );
  });
});
