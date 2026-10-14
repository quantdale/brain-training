import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { CompleteSessionInput } from '@/db';
import type { GameHostProps } from '@/components/game-host';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import type { StimulusStageProps } from '../components/stimulus-stage';
import { VIGILANCE_DIFFICULTY_PARAMS } from '../difficulty';
import { generateStream } from '../generator';
import VigilanceScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));

let mockHost: GameHostProps;
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => {
    mockHost = props;
    return React.createElement(actual.GameHost, props);
  } };
});

// Preserve the real board and retain the exact callback given to the rendered
// native control. Replaying it models queued delivery after a render/pause.
let mockGo: StimulusStageProps['onGo'];
jest.mock('../components/stimulus-stage', () => {
  const actual = jest.requireActual<typeof import('../components/stimulus-stage')>('../components/stimulus-stage');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, StimulusStage: (props: StimulusStageProps) => {
    mockGo = props.onGo;
    return React.createElement(actual.StimulusStage, props);
  } };
});

const SEED = '077-vigilance-stall';
const NORMAL = VIGILANCE_DIFFICULTY_PARAMS.normal;
const SLOT = NORMAL.stimulusOnMs + NORMAL.isiMs;

async function setup() {
  const timers = jest.spyOn(global, 'setInterval');
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
  }));
  await render(<VigilanceScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const stream = generateStream(createRng(SEED), NORMAL);
  expect(stream.trials.slice(0, 2).map((trial) => trial.isTarget)).toEqual([false, false]);
  const ticker = () => {
    const callback = timers.mock.calls.filter((call) => call[1] === 250).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error('No real Vigilance ticker scheduled');
    return callback as () => void;
  };
  const tick = async () => { await act(async () => { ticker()(); }); };
  const at = async (now: number) => { await act(async () => { clock.set(now); }); };
  return { clock, completeSession, stream, ticker, tick, at };
}

function shownDigit() {
  return screen.getByTestId(testId(GAME_ID, 'stimulus-digit')).props.children;
}

async function finishRemaining(context: Awaited<ReturnType<typeof setup>>, fromIndex: number) {
  const { clock, stream, at, tick } = context;
  for (const trial of stream.trials.slice(fromIndex)) {
    expect(shownDigit()).toBe(String(trial.digit));
    const responseMs = trial.isTarget ? NORMAL.responseWindowMs : 400;
    await at(clock.now() + responseMs);
    if (trial.isTarget) {
      await tick();
      expect(screen.getByText('Held — nice')).toBeOnTheScreen();
    } else {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
      expect(screen.getByText('Go!')).toBeOnTheScreen();
    }
    await at(clock.now() + SLOT - responseMs);
    await tick();
  }
}

describe('Vigilance real caller exposure and lifecycle fairness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('charges only the displayed trial after a JS stall and gives the next digit its real exposure', async () => {
    const { stream, at, tick } = await setup();
    expect(shownDigit()).toBe(String(stream.trials[0].digit));
    // Advance the authoritative clock without running scheduled timers: this
    // is a JS stall, rather than 40 healthy 250 ms display/timer commits.
    await at(10_000);
    await tick();
    expect(screen.getByText('Missed one')).toBeOnTheScreen();
    await tick();
    expect(shownDigit()).toBe(String(stream.trials[1].digit));
    await tick();
    expect(shownDigit()).toBe(String(stream.trials[1].digit));
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(liveAudioHaptics.feedback).toHaveBeenCalledTimes(1);
    await at(10_001);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    expect(screen.getByText('Go!')).toBeOnTheScreen();
  });

  it('cannot resolve an unseen trial when queued ticks are delivered in one React batch', async () => {
    const { stream, at, ticker } = await setup();
    const queued = ticker();
    await at(10_000);
    await act(async () => { queued(); queued(); queued(); });
    // A batch may resolve/advance the displayed trial, but the newly committed
    // cue must remain unanswered and receive its own response opportunity.
    expect(screen.queryByTestId(testId(GAME_ID, 'trial', '3'))).toBeNull();
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(shownDigit()).toBe(String(stream.trials[1].digit));
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.map(([event]) => event)).toEqual(['failure']);
  });

  it('measures next-stimulus exposure from its actual display commit after delayed rendering', async () => {
    const { clock, at, ticker, tick, stream } = await setup();
    const queued = ticker();
    await at(10_000);
    await act(async () => { queued(); queued(); clock.advance(5_000); });
    expect(shownDigit()).toBe(String(stream.trials[1].digit));
    await tick();
    expect(shownDigit()).toBe(String(stream.trials[1].digit));
    expect(screen.queryByText('Missed one')).toBeNull();
  });

  it('drops a stale start invocation and leaves the active stream intact', async () => {
    await setup();
    const start = mockHost.onStart;
    await act(async () => { start(); start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'trial', '1'))).toBeOnTheScreen();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('claims a rendered GO only once before React commits, including sensory feedback', async () => {
    const { at } = await setup();
    await at(300);
    const press = mockGo;
    await act(async () => { press(); press(); });
    expect(screen.getByText('Go!')).toBeOnTheScreen();
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.map(([event]) => event)).toEqual(['tap', 'correct']);
  });

  it('rejects the previous rendered GO when a different trial is displayed', async () => {
    const { at, tick } = await setup();
    const oldGo = mockGo;
    await at(300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    await at(SLOT);
    await tick();
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldGo(); });
    expect(screen.queryByText('Go!')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('rejects an old trial ticker even when the current trial deadline is reached', async () => {
    const { at, tick, ticker } = await setup();
    const oldTick = ticker();
    await at(300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    await at(SLOT);
    await tick();
    await at(SLOT + NORMAL.responseWindowMs);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldTick(); });
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await tick();
    expect(screen.getByText('Missed one')).toBeOnTheScreen();
  });

  it('rejects a pre-pause GO after resume and keeps active reaction time', async () => {
    const context = await setup();
    const { at, clock, tick, completeSession } = context;
    const oldGo = mockGo;
    await at(300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await at(10_300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldGo(); });
    expect(screen.queryByText('Go!')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await act(async () => { clock.advance(100); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    expect(screen.getByText('Go!')).toBeOnTheScreen();
    await at(clock.now() + SLOT - 400);
    await tick();
    await finishRemaining(context, 1);
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession.mock.calls[0][0].session).toMatchObject({
      durationMs: NORMAL.trials * SLOT,
      rawResult: { diagnosticMetadata: { pausedDurationMs: 10_000 }, meanReactionMs: 400, bestReactionMs: 400, omissions: 0 },
    });
  });

  it('blocks queued GO immediately when pause arrives before React commits the overlay', async () => {
    const { at } = await setup();
    await at(300);
    const go = mockGo;
    await act(async () => { mockHost.onPause(); go(); });
    expect(screen.getByTestId(testId(GAME_ID, 'resume'))).toBeOnTheScreen();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('keeps an old ticker inert across pause/resume without granting a new window', async () => {
    const { at, ticker, tick, clock } = await setup();
    const oldTick = ticker();
    await at(300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await at(10_300);
    await act(async () => { oldTick(); });
    expect(screen.queryByText('Missed one')).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { clock.advance(NORMAL.responseWindowMs - 300); oldTick(); });
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await tick();
    expect(screen.getByText('Missed one')).toBeOnTheScreen();
  });

  it('rejects old-session input and timers after Play again', async () => {
    const { at, ticker } = await setup();
    const oldGo = mockGo;
    const oldTick = ticker();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await at(300);
    await act(async () => { oldGo(); });
    expect(screen.queryByText('Go!')).toBeNull();
    await at(NORMAL.responseWindowMs);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldTick(); });
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('ignores callbacks once the SDK session is abandoned', async () => {
    const { at, ticker } = await setup();
    const go = mockGo;
    const tick = ticker();
    await act(async () => { mockHost.onQuit(); });
    await at(300);
    await act(async () => { go(); });
    expect(screen.queryByText('Go!')).toBeNull();
    await at(NORMAL.responseWindowMs);
    await act(async () => { tick(); });
    expect(screen.queryByText('Missed one')).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('rejects a GO exactly at the real response deadline while the expiry tick is queued', async () => {
    const { at, tick } = await setup();
    await at(NORMAL.responseWindowMs);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    expect(screen.queryByText('Go!')).toBeNull();
    await tick();
    expect(screen.getByText('Missed one')).toBeOnTheScreen();
  });

  it('accepts a GO one millisecond inside the actual response deadline', async () => {
    const { at } = await setup();
    await at(NORMAL.responseWindowMs - 1);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'go-button')));
    expect(screen.getByText('Go!')).toBeOnTheScreen();
  });

  it('finishes the generated fixed trial count after a stall and persists only displayed-trial outcomes', async () => {
    const context = await setup();
    const { at, tick, completeSession, stream } = context;
    await at(10_000);
    await tick();
    await tick();
    await finishRemaining(context, 1);
    expect(completeSession).toHaveBeenCalledTimes(1);
    const holds = stream.trials.filter((trial) => trial.isTarget).length;
    expect(completeSession.mock.calls[0][0].session).toMatchObject({
      gameVersion: 1_001_000,
      scoringVersion: 1_001_000,
      generatorVersion: 1_000_000,
      durationMs: 10_000 + (NORMAL.trials - 1) * SLOT,
      rawResult: {
        gameVersion: '1.1.0', scoringVersion: '1.1.0', generatorVersion: '1.0.0',
        seed: SEED, trialsTotal: NORMAL.trials, trialsPlayed: NORMAL.trials,
        omissions: 1, hits: NORMAL.trials - holds - 1, correctHolds: holds,
        commissions: 0, meanReactionMs: 400, diagnosticMetadata: { pausedDurationMs: 0 },
      },
    });
  });
});
