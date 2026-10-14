import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import type { ReactElement } from 'react';

import type { CompleteSessionInput } from '@/db';
import type { GameHostProps } from '@/components/game-host';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import type { ResponseControlsProps } from '../components/response-controls';
import { PROSPECTIVE_CUE_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import GameScreen from '../screen';
import { GO_HIT_POINTS, GO_SPEED_BONUS } from '../scoring';
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

let mockRespond: (kind: 'go' | 'signal', event?: GestureResponderEvent) => void;
jest.mock('../components/response-controls', () => {
  const actual = jest.requireActual<typeof import('../components/response-controls')>('../components/response-controls');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, ResponseControls: (props: ResponseControlsProps) => {
    mockRespond = props.onRespond;
    return React.createElement(actual.ResponseControls, props);
  } };
});

const NORMAL = PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal;
const SEED = '077-cue-clock';
const ROUND = generateRound({ rng: createRng(SEED), roundIndex: 0, signalCount: NORMAL.initialSignalCount, streamLen: NORMAL.streamLen, prevActiveSignalIds: null });
const kind = (index: number) => ROUND.items[index].isSignal ? 'signal' as const : 'go' as const;

async function setup() {
  const intervals = jest.spyOn(global, 'setInterval');
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'briefing-start')));
  const ticker = () => {
    const callback = intervals.mock.calls.filter((call) => call[1] === 50).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error('Missing actual Cue Keeper interval');
    return callback as () => void;
  };
  const tick = async () => { await act(async () => ticker()()); };
  const advance = async (ms: number) => { await act(async () => { clock.advance(ms); }); };
  return { clock, ticker, tick, advance };
}

function itemNumber() {
  return screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel;
}
function score() {
  return Number(String(screen.getByTestId(testId(GAME_ID, 'score')).props.children).match(/(\d+)\s*$/)?.[1]);
}
function nativePress() {
  return { nativeEvent: { timestamp: 123, target: 1 } } as unknown as GestureResponderEvent;
}

describe('Cue Keeper measured display-window callers', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('expires the displayed item on one delayed tick without charging the next unseen item', async () => {
    const { ticker, advance, tick } = await setup();
    const oldTick = ticker();
    await advance(10_000);
    await act(async () => { oldTick(); oldTick(); oldTick(); });
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    expect(screen.getByTestId(testId(GAME_ID, 'verdict-timeout'))).toBeOnTheScreen();
    await tick();
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    expect(liveAudioHaptics.feedback).toHaveBeenCalledTimes(1);
  });

  it('anchors a new item after delayed rendering rather than at the preceding callback', async () => {
    const { clock, ticker, advance, tick } = await setup();
    const queued = ticker();
    await advance(10_000);
    await act(async () => { queued(); clock.advance(5_000); });
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    await tick();
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    await advance(NORMAL.initialItemMs - 1);
    await tick();
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    await advance(1);
    await tick();
    expect(itemNumber()).toBe(`Item 3 of ${NORMAL.streamLen}`);
  });

  it.each([NORMAL.initialItemMs, NORMAL.initialItemMs + 1])('expires a response at active ms %i before delayed timer delivery', async (elapsed) => {
    const { advance } = await setup();
    await advance(elapsed);
    await act(async () => mockRespond(kind(0)));
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    expect(screen.getByTestId(testId(GAME_ID, 'verdict-timeout'))).toBeOnTheScreen();
    expect(score()).toBe(0);
  });

  it('pays the GO speed bonus from measured press time even when no ticker ran', async () => {
    const { advance } = await setup();
    const filler = ROUND.items.findIndex((item) => !item.isSignal);
    for (let index = 0; index < filler; index += 1) await act(async () => mockRespond(kind(index)));
    const before = score();
    await advance(NORMAL.initialItemMs / 2);
    await act(async () => mockRespond('go'));
    expect(score() - before).toBe(GO_HIT_POINTS + Math.round(GO_SPEED_BONUS / 2));
  });

  it('claims a rendered response once in a batch and rejects its callback after the next item mounts', async () => {
    await setup();
    const oldRespond = mockRespond;
    await act(async () => { oldRespond(kind(0)); oldRespond(kind(0)); });
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => oldRespond(kind(0)));
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await act(async () => mockRespond(kind(1)));
    expect(itemNumber()).toBe(`Item 3 of ${NORMAL.streamLen}`);
  });

  it('deduplicates physical event identity across commits but accepts a distinct new press', async () => {
    await setup();
    const first = nativePress();
    // The generic event API preserves payload identity; press() deep-merges
    // overrides into a freshly generated native event in RNTL 14.
    await fireEvent(screen.getByTestId(testId(GAME_ID, kind(0))), 'press', first);
    const duplicateWrapper = { ...first, nativeEvent: first.nativeEvent };
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await fireEvent(screen.getByTestId(testId(GAME_ID, kind(1))), 'press', duplicateWrapper);
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId(testId(GAME_ID, kind(1))), 'press', nativePress());
    expect(itemNumber()).toBe(`Item 3 of ${NORMAL.streamLen}`);
  });

  it('preserves the exact sub-tick pause remainder and retires pre-pause input/timers', async () => {
    const { clock, ticker, advance, tick } = await setup();
    const oldRespond = mockRespond;
    const oldTick = ticker();
    await advance(333);
    await act(async () => { mockHost.onPause(); oldRespond(kind(0)); });
    await advance(10_000);
    await act(async () => oldTick());
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldRespond(kind(0)); oldTick(); });
    expect(itemNumber()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    await act(async () => { clock.advance(NORMAL.initialItemMs - 333 - 1); });
    await tick();
    expect(itemNumber()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    await advance(1);
    await tick();
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
  });

  it('freezes the exact tutorial-covered remainder and rejects covered/stale responses', async () => {
    const { ticker, advance, tick } = await setup();
    const oldRespond = mockRespond;
    const oldTick = ticker();
    await advance(333);
    await act(async () => { mockHost.onHelp(); oldRespond(kind(0)); });
    await advance(10_000);
    await act(async () => oldTick());
    // GameHost currently mounts tutorials only in intro. Exercise the real
    // screen's supplied close callback, without pretending a replay UI exists.
    const tutorial = mockHost.tutorial as ReactElement<{ onSkip: () => void }>;
    await act(async () => tutorial.props.onSkip());
    await act(async () => { oldRespond(kind(0)); oldTick(); });
    expect(itemNumber()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    await advance(NORMAL.initialItemMs - 333);
    await tick();
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
  });

  it('drops a captured start invocation while the current session is active', async () => {
    await setup();
    const start = mockHost.onStart;
    await act(async () => { start(); start(); });
    expect(itemNumber()).toBe(`Item 1 of ${NORMAL.streamLen}`);
  });

  it('keeps a queued start inert until completion is committed', async () => {
    await setup();
    const start = mockHost.onStart;
    const panel = mockHost.qaPanel as ReactElement<{ onForceLose: () => void }>;
    await act(async () => { panel.props.onForceLose(); start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'briefing-start'))).toBeOnTheScreen();
  });

  it('rejects a previous session response and ticker after restart mounts item zero again', async () => {
    const { ticker } = await setup();
    const oldRespond = mockRespond;
    const oldTick = ticker();
    const panel = mockHost.qaPanel as ReactElement<{ onForceLose: () => void }>;
    await act(async () => panel.props.onForceLose());
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'briefing-start')));
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldRespond(kind(0)); oldTick(); });
    expect(itemNumber()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await act(async () => mockRespond(kind(0)));
    expect(itemNumber()).toBe(`Item 2 of ${NORMAL.streamLen}`);
  });
});
