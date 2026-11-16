import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import GameScreen from '../screen';
import { quickCompareGameReducer as reduce, createInitialQuickCompareState } from '../reducer';
import { GAME_ID } from '../types';
let mockComparison: ComponentProps<typeof import('../components/comparison').Comparison>;
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
jest.mock('../components/comparison', () => {
  const actual = jest.requireActual<typeof import('../components/comparison')>('../components/comparison');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, Comparison: (props: typeof mockComparison) => { mockComparison = props; return React.createElement(actual.Comparison, props); } };
});
function start() { return reduce(createInitialQuickCompareState(), { type: 'start-session', seed: 'deadline', sessionId: 'deadline', startedAtMs: 0, spawnedAtMs: 0 }); }
describe('Quick Compare exclusive deadline ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  it.each([false, true])('has order-independent outcomes either side of equality (resumed=%s)', (resumed) => {
    let initial = start();
    if (resumed) {
      initial = reduce(initial, { type: 'pause' });
      initial = reduce(initial, { type: 'resume', nowMs: 10000, remainingMs: 500 });
    }
    for (const offset of [-0.25, 0, 0.25]) {
      const nowMs = initial.deadlineMs! + offset;
      const answer = { type: 'answer' as const, index: initial.round!.correctIndex, nowMs };
      const timeout = { type: 'answer-timeout' as const, nowMs };
      const answerFirst = reduce(reduce(initial, answer), timeout);
      const timeoutFirst = reduce(reduce(initial, timeout), answer);
      expect(answerFirst).toEqual(timeoutFirst);
      expect(answerFirst.stats.roundsCorrect + answerFirst.stats.roundsWrong + answerFirst.stats.roundsMissed).toBe(1);
      expect(answerFirst.lastVerdict).toBe(offset < 0 ? 'correct' : 'miss');
    }
  });
  it.each([
    { resumed: false, expiryFirst: false }, { resumed: false, expiryFirst: true },
    { resumed: true, expiryFirst: false }, { resumed: true, expiryFirst: true },
  ])('captured callbacks agree at equality (resumed=$resumed, expiryFirst=$expiryFirst)', async ({ resumed, expiryFirst }) => {
    const scheduled = jest.spyOn(global, 'setTimeout');
    const clock = createFakeClock(0);
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed="deadline" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    if (resumed) {
      clock.advance(100);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
      clock.advance(5000);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    }
    const answer = mockComparison.onSelect;
    const index = mockComparison.round.correctIndex;
    const audio = jest.spyOn(liveAudioHaptics, 'playSfx');
    const remaining = start().windowMs - (resumed ? 100 : 0);
    const expire = scheduled.mock.calls.filter((call) => call[1] === remaining).at(-1)![0] as () => void;
    clock.advance(remaining);
    await act(async () => {
      if (expiryFirst) { expire(); answer(index); }
      else { answer(index); expire(); }
    });
    expect(audio).not.toHaveBeenCalledWith('correct');
    expect(screen.getByTestId(testId(GAME_ID, 'feedback'))).toHaveTextContent(/Too slow/);
  });
});
