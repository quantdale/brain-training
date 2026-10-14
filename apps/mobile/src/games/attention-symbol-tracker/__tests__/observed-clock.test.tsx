import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import type { ReactElement } from 'react';

import type { CompleteSessionInput } from '@/db';
import type { GameHostProps } from '@/components/game-host';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import type { BoardProps } from '../components/board';
import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import GameScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));

let mockHost: GameHostProps;
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => { mockHost = props; return React.createElement(actual.GameHost, props); } };
});

let mockTap: (index: number, event?: GestureResponderEvent) => void;
jest.mock('../components/board', () => {
  const actual = jest.requireActual<typeof import('../components/board')>('../components/board');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, Board: (props: BoardProps) => {
    if (props.testID === 'attention-symbol-tracker.respond-board') mockTap = props.onPressCell;
    return React.createElement(actual.Board, props);
  } };
});

const NORMAL = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;
const SEED = '077-symbol-clock';
const ROUND = generateRound({ rng: createRng(SEED), roundIndex: 0, gridSize: NORMAL.gridSize, tokenCount: NORMAL.tokenCount, trackCount: NORMAL.initialTrackCount, distractors: NORMAL.distractors, prevTracked: null });
const TARGETS = ROUND.trackedSymbolIds.map((id) => ROUND.respondBoard.indexOf(id));

async function setup() {
  const intervals = jest.spyOn(global, 'setInterval');
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const ticker = () => {
    const callback = intervals.mock.calls.filter((call) => call[1] === 100).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error('Missing actual Symbol Tracker interval');
    return callback as () => void;
  };
  const tick = async () => { await act(async () => ticker()()); };
  const advance = async (ms: number) => { await act(async () => { clock.advance(ms); }); };
  const respond = async () => {
    await advance(NORMAL.observeMs);
    // Deliver the already scheduled pacing ticks so this helper enters the
    // respond phase both before and after the measured-clock repair.
    await act(async () => { jest.advanceTimersByTime(NORMAL.observeMs); });
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();
  };
  return { clock, ticker, tick, advance, respond };
}

function captureSubmit() {
  let fiber = screen.getByTestId(testId(GAME_ID, 'submit')).unstable_fiber;
  while (fiber !== null) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') return onPress as () => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual submit callback');
}
function selected(count: number) {
  expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toBe(`${count} of ${NORMAL.initialTrackCount} symbols selected`);
}
function nativePress() {
  return { nativeEvent: { timestamp: 123, target: 1 } } as unknown as GestureResponderEvent;
}

describe('Symbol Tracker measured display-window callers', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('ends a displayed observe window on one delayed tick and leaves the new respond window untouched', async () => {
    const { ticker, advance, tick } = await setup();
    const queued = ticker();
    await advance(10_000);
    await act(async () => { queued(); queued(); queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();
    await tick();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('begins respond time at its actual delayed display commit', async () => {
    const { clock, ticker, advance, tick } = await setup();
    const queued = ticker();
    await advance(10_000);
    await act(async () => { queued(); clock.advance(5_000); });
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();
    await tick();
    await advance(NORMAL.respondDeadlineMs - 1);
    await tick();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
    await advance(1);
    await tick();
    expect(screen.getByTestId(testId(GAME_ID, 'respond-timeout'))).toBeOnTheScreen();
  });

  it('does not manufacture observe time from repeated early callback delivery', async () => {
    const { ticker } = await setup();
    const queued = ticker();
    await act(async () => { for (let index = 0; index < 30; index += 1) queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'observe-board'))).toBeOnTheScreen();
  });

  it.each([NORMAL.respondDeadlineMs, NORMAL.respondDeadlineMs + 1])('expires a late selection at active ms %i before timer delivery', async (elapsed) => {
    const { respond, advance } = await setup();
    await respond();
    await advance(elapsed);
    await act(async () => mockTap(TARGETS[0], nativePress()));
    expect(screen.getByTestId(testId(GAME_ID, 'respond-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.map(([event]) => event)).toEqual(['wrong']);
  });

  it('treats overdue submit as deadline expiry and retains only the on-time selections', async () => {
    const { respond, advance } = await setup();
    await respond();
    await act(async () => mockTap(TARGETS[0], nativePress()));
    const submit = captureSubmit();
    await advance(NORMAL.respondDeadlineMs + 1);
    await act(async () => submit());
    expect(screen.getByTestId(testId(GAME_ID, 'respond-timeout'))).toBeOnTheScreen();
    expect(screen.getByText(/You found/)).toHaveTextContent(/1\s*of\s*2/);
  });

  it('deduplicates the same physical selection across commits while allowing an intentional new toggle', async () => {
    const { respond } = await setup();
    await respond();
    const first = nativePress();
    // Keep the exact payload: RNTL 14 press() manufactures a fresh native event.
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0]))), 'press', first);
    selected(1);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0]))), 'press', { ...first, nativeEvent: first.nativeEvent });
    selected(1);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0]))), 'press', nativePress());
    selected(0);
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.map(([event]) => event)).toEqual(['tap']);
  });

  it('accepts different known symbols in one batch but claims submit only once', async () => {
    const { respond } = await setup();
    await respond();
    const tap = mockTap;
    const submit = captureSubmit();
    await act(async () => { tap(TARGETS[0], nativePress()); tap(TARGETS[1], nativePress()); submit(); submit(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.map(([event]) => event)).toEqual(['tap', 'tap', 'correct']);
  });

  it('rejects earlier-round tap/submit callbacks against a later respond board', async () => {
    const { respond, advance } = await setup();
    await respond();
    const oldTap = mockTap;
    const oldSubmit = captureSubmit();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    await advance(NORMAL.observeMs);
    await act(async () => { jest.advanceTimersByTime(NORMAL.observeMs); });
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldTap(TARGETS[0], nativePress()); oldSubmit(); });
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();
    selected(0);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('keeps the exact sub-tick observe remainder across pause and retires the old ticker', async () => {
    const { ticker, advance, tick } = await setup();
    const oldTick = ticker();
    await advance(333);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(10_000);
    await act(async () => oldTick());
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await advance(NORMAL.observeMs - 333);
    await act(async () => oldTick());
    expect(screen.getByTestId(testId(GAME_ID, 'observe-board'))).toBeOnTheScreen();
    await tick();
    expect(screen.getByTestId(testId(GAME_ID, 'respond-board'))).toBeOnTheScreen();
  });

  it('freezes the respond budget and retires queued tap/submit callbacks immediately at pause', async () => {
    const { respond, advance, tick } = await setup();
    await respond();
    const oldTap = mockTap;
    const oldSubmit = captureSubmit();
    await advance(333);
    await act(async () => { mockHost.onPause(); oldTap(TARGETS[0], nativePress()); oldSubmit(); });
    await advance(10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldTap(TARGETS[0], nativePress()); oldSubmit(); });
    selected(0);
    await advance(NORMAL.respondDeadlineMs - 333);
    await tick();
    expect(screen.getByTestId(testId(GAME_ID, 'respond-timeout'))).toBeOnTheScreen();
  });

  it.each(['observe', 'respond'] as const)('freezes the %s window while the replay tutorial covers it', async (phase) => {
    const { respond, advance, tick } = await setup();
    if (phase === 'respond') await respond();
    await advance(333);
    await act(async () => mockHost.onHelp());
    await advance(10_000);
    await act(async () => { jest.advanceTimersByTime(10_000); });
    // The shared host has no mounted in-session replay surface. Use the
    // actual close callback supplied by this screen, rather than invent one.
    const tutorial = mockHost.tutorial as ReactElement<{ onSkip: () => void }>;
    await act(async () => tutorial.props.onSkip());
    expect(screen.getByTestId(testId(GAME_ID, `${phase}-board`))).toBeOnTheScreen();
    await advance((phase === 'observe' ? NORMAL.observeMs : NORMAL.respondDeadlineMs) - 333);
    await tick();
    expect(screen.getByTestId(testId(GAME_ID, phase === 'observe' ? 'respond-board' : 'respond-timeout'))).toBeOnTheScreen();
  });

  it('drops a captured start invocation while the current session is active', async () => {
    await setup();
    const start = mockHost.onStart;
    await act(async () => { start(); start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'observe-board'))).toBeOnTheScreen();
  });

  it('keeps a queued start inert until completion is committed', async () => {
    await setup();
    const start = mockHost.onStart;
    const panel = mockHost.qaPanel as ReactElement<{ onForceLose: () => void }>;
    await act(async () => { panel.props.onForceLose(); start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'observe-board'))).toBeOnTheScreen();
  });

  it('rejects previous-session selection, submit and timer callbacks after a new respond board mounts', async () => {
    const { respond, ticker } = await setup();
    await respond();
    const oldTap = mockTap;
    const oldSubmit = captureSubmit();
    const oldTick = ticker();
    const panel = mockHost.qaPanel as ReactElement<{ onForceLose: () => void }>;
    await act(async () => panel.props.onForceLose());
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await respond();
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldTap(TARGETS[0], nativePress()); oldSubmit(); oldTick(); });
    selected(0);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await act(async () => mockTap(TARGETS[0], nativePress()));
    selected(1);
  });

  it('keeps a tutorial selection when the native event is delivered twice', async () => {
    await render(<GameScreen clock={createFakeClock()} tutorialStore={createInMemoryTutorialStore()} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await act(async () => { jest.advanceTimersByTime(1500); });
    const demo = generateRound({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, gridSize: 9, tokenCount: 4,
      trackCount: 2, distractors: 0, prevTracked: null });
    const cells = demo.trackedSymbolIds.map((id) => demo.respondBoard.indexOf(id));
    const first = nativePress();
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(cells[0]))), 'press', first);
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(cells[0]))), 'press', { ...first, nativeEvent: first.nativeEvent });
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'cell', String(cells[1]))), 'press', nativePress());
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeOnTheScreen();
  });
});
