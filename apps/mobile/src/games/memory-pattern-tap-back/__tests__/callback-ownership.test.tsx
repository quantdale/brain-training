import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GameHostProps } from '@/components/game-host';
import type { GameButtonProps } from '@/components/game-ui';
import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import GameScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
let mockHost: GameHostProps;
const mockPress = new Map<string, () => void>();
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => { mockHost = props; return React.createElement(actual.GameHost, props); } };
});
jest.mock('@/components/game-ui', () => {
  const actual = jest.requireActual<typeof import('@/components/game-ui')>('@/components/game-ui');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameButton: (props: GameButtonProps) => { mockPress.set(props.testID, props.onPress); return React.createElement(actual.GameButton, props); } };
});
async function mount() {
  const clock = createFakeClock(0);
  const tutorialStore = createInMemoryTutorialStore();
  tutorialStore.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={tutorialStore} sessionSeed="game-b-ownership" persistSession={{ completeSession }} />);
  return { clock, completeSession };
}
async function finish(clock: ReturnType<typeof createFakeClock>) {
  for (let step = 0; step < 20 && screen.queryByTestId(testId(GAME_ID, 'observe-grid')); step += 1) {
    await act(async () => { clock.advance(5000); jest.advanceTimersByTime(5000); });
  }
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', '0')));
  // If tile zero was correct, a different tile necessarily ends the round.
  if (!screen.queryByTestId(testId(GAME_ID, 'next-round'))) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', '1')));
  if (!screen.queryByTestId(testId(GAME_ID, 'next-round'))) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', '1')));
  expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
}
const next = () => mockPress.get(testId(GAME_ID, 'next-round'))!;
describe('Start and continuation callback ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); mockPress.clear(); });
  afterEach(() => { jest.useRealTimers(); });
  it('delivers one captured Start twice before commit and again after commit without starting twice', async () => {
    await mount();
    const start = mockHost.onStart;
    await act(async () => { start(); start(); });
    await act(async () => { start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });
  it('retires Next across same-batch pause/resume and requires the current result callback', async () => {
    const { clock } = await mount();
    await act(async () => mockHost.onStart());
    await finish(clock);
    const oldNext = next();
    const pause = mockHost.onPause!;
    await act(async () => { pause(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    const resume = mockHost.onResume;
    await act(async () => { resume(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round', '2'))).toBeNull();
    await act(async () => next()());
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });
  it('rejects a previous result callback on a later round and after restart', async () => {
    const { clock } = await mount();
    await act(async () => mockHost.onStart());
    await finish(clock);
    const oldNext = next();
    await act(async () => { oldNext(); oldNext(); });
    await finish(clock);
    await act(async () => oldNext());
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    const restart = mockPress.get(testId(GAME_ID, 'restart'))!;
    await act(async () => { restart(); restart(); });
    await finish(clock);
    await act(async () => oldNext());
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
  });
});
