import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';
import GameScreen from '../screen';
import { flexibilityTaskSwitchReducer as reduce } from '../reducer';
import { createInitialFlexibilityTaskSwitchState, continuationStamp, GAME_ID } from '../types';
import type { FlexibilityTaskSwitchGameState } from '../types';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
}));

const SEED = '077-paused-next';
function start(sessionId = 'session'): FlexibilityTaskSwitchGameState {
  return reduce(createInitialFlexibilityTaskSwitchState(), {
    type: 'start-session', seed: SEED, sessionId, startedAtMs: 0,
  });
}

function nextAction(state: FlexibilityTaskSwitchGameState) {
  return {
    type: 'next-round' as const,
    stamp: continuationStamp(state),
  };
}

function finishRound(state: FlexibilityTaskSwitchGameState): FlexibilityTaskSwitchGameState {
  return reduce(state, { type: 'answer', index: state.round!.correctIndex, responseMs: 0 });
}

async function press(part: string, index = '') {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, part, index)));
}

async function playRound(state: FlexibilityTaskSwitchGameState, _clock: ReturnType<typeof createFakeClock>) {
  await press('option-grid.option', String(state.round!.correctIndex));
  expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
}

function capturePress(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') return onPress as () => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual Next press callback');
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

describe('result continuation ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('keeps a completed round frozen while paused and requires a fresh continuation after resume', () => {
    const result = finishRound(start());
    expect(result.phase).toBe('trialResult');
    const oldNext = nextAction(result);
    const paused = reduce(result, { type: 'pause' });
    expect(paused.paused).toBe(true);
    expect(reduce(paused, oldNext)).toBe(paused);
    const resumed = reduce(paused, { type: 'resume' });
    expect(resumed.paused).toBe(false);
    expect(reduce(resumed, oldNext)).toBe(resumed);
    const next = reduce(resumed, nextAction(resumed));
    expect(next.roundIndex).toBe(1);
    expect(next.paused).toBe(false);
  });

  it('rejects an earlier round or session continuation when another result is displayed', () => {
    const first = finishRound(start());
    const oldNext = nextAction(first);
    const second = finishRound(reduce(first, oldNext));
    expect(second.phase).toBe('trialResult');
    expect(second.roundIndex).toBe(1);
    expect(reduce(second, oldNext)).toBe(second);
    const restarted = finishRound(start('other-session'));
    expect(reduce(restarted, oldNext)).toBe(restarted);
    expect(reduce(second, nextAction(second)).roundIndex).toBe(2);
  });

  it('retires the rendered Next across pause and later results, while fresh presses still advance', async () => {
    const clock = await renderGame();
    const first = finishRound(start());
    await playRound(start(), clock);
    const oldNext = capturePress('next-round');
    const pause = capturePress('pause');
    await act(async () => { pause(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'), { includeHiddenElements: true })).toBeOnTheScreen();
    const resume = capturePress('resume');
    await act(async () => { resume(); oldNext(); });
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    await press('next-round');
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    const secondStart = reduce(first, nextAction(first));
    await playRound(secondStart, clock);
    await act(async () => oldNext());
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await press('next-round');
    expect(screen.getByTestId(testId(GAME_ID, 'round', '3'))).toBeOnTheScreen();
  });
});
