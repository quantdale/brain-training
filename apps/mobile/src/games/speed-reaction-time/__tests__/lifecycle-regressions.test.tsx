import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import type { TriggerButtonProps } from '../components/trigger';
import { SPEED_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundDelay } from '../generator';
import SpeedScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

let mockRenderedTrigger: TriggerButtonProps['onPress'];
jest.mock('../components/trigger', () => {
  const actual = jest.requireActual<typeof import('../components/trigger')>('../components/trigger');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, TriggerButton: (props: TriggerButtonProps) => {
    mockRenderedTrigger = props.onPress;
    return React.createElement(actual.TriggerButton, props);
  } };
});

const SEED = '077-reaction-lifecycle';
const PARAMS = SPEED_DIFFICULTY_PARAMS.easy;

function waitForRound(roundIndex: number) {
  return generateRoundDelay({
    rng: createRng(SEED), roundIndex, minDelayMs: PARAMS.minDelayMs, maxDelayMs: PARAMS.maxDelayMs,
  });
}

async function start() {
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
  }));
  await render(<SpeedScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return clock;
}

async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => { clock.advance(ms); jest.advanceTimersByTime(ms); });
}

describe('Reaction Time queued lifecycle callbacks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('keeps a queued response timeout inert while the pause overlay is present', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await start();
    await advance(clock, waitForRound(0));
    const queued = timers.mock.calls.filter((call) => call[1] === PARAMS.timeoutMs).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
  });

  it('rejects an old timeout after resume until the remaining active response budget expires', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await start();
    await advance(clock, waitForRound(0));
    const queued = timers.mock.calls.filter((call) => call[1] === PARAMS.timeoutMs).at(-1)?.[0];
    await advance(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    await advance(clock, PARAMS.timeoutMs - 401);
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
  });

  it('rejects a response at the exact deadline before a delayed timer callback', async () => {
    const clock = await start();
    await advance(clock, waitForRound(0));
    await act(async () => { clock.advance(PARAMS.timeoutMs); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'reaction-ms'))).toBeNull();
  });

  it('does not let the previous round timeout consume the next GO signal', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await start();
    await advance(clock, waitForRound(0));
    const queued = timers.mock.calls.filter((call) => call[1] === PARAMS.timeoutMs).at(-1)?.[0];
    await advance(clock, 100);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    await advance(clock, waitForRound(1));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
  });

  it('preserves the remaining wait budget and ignores a queued pre-pause GO callback', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await start();
    const delay = waitForRound(0);
    const queued = timers.mock.calls.filter((call) => call[1] === delay).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    await advance(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'wait-status'))).toBeOnTheScreen();
    await advance(clock, delay - 401);
    expect(screen.getByTestId(testId(GAME_ID, 'wait-status'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
  });

  it('drops a waiting trigger delivered after GO, then accepts the current trigger', async () => {
    const clock = await start();
    const waitTrigger = mockRenderedTrigger;
    await advance(clock, waitForRound(0));
    await advance(clock, 100);
    await act(async () => { waitTrigger(); });
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'reaction-ms'))).toHaveTextContent('Reaction 100 ms');
  });

  it('claims a GO round once when one rendered trigger is delivered twice before React commits', async () => {
    const clock = await start();
    await advance(clock, waitForRound(0));
    await advance(clock, 100);
    const trigger = mockRenderedTrigger;
    await act(async () => { trigger(); trigger(); });
    expect(screen.getByTestId(testId(GAME_ID, 'reaction-ms'))).toHaveTextContent('Reaction 100 ms');
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('rejects a pre-pause trigger after resume and preserves the active reaction reading', async () => {
    const clock = await start();
    await advance(clock, waitForRound(0));
    const oldTrigger = mockRenderedTrigger;
    await advance(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldTrigger(); });
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'reaction-ms'))).toHaveTextContent('Reaction 400 ms');
  });

  it('drops an old-session trigger and timeout after Play again creates a new GO round', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = await start();
    await advance(clock, waitForRound(0));
    const trigger = mockRenderedTrigger;
    const queued = timers.mock.calls.filter((call) => call[1] === PARAMS.timeoutMs).at(-1)?.[0];
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await advance(clock, waitForRound(0));
    await act(async () => { trigger(); if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
  });
});
