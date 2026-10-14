import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import type { ReactElement } from 'react';

import type { CompleteSessionInput } from '@/db';
import type { GameHostProps } from '@/components/game-host';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';
import type { BoardProps } from '../components/board';
import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { GRID_RECALL_DIFFICULTY_PARAMS } from '../difficulty';
import { generateTargetCells } from '../generator';
import GameScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
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
    if (props.testID === 'memory-grid-recall.input-board') mockTap = props.onPressCell;
    return React.createElement(actual.Board, props);
  } };
});
const NORMAL = GRID_RECALL_DIFFICULTY_PARAMS.normal;
const SEED = '077-grid-input';
const TARGETS = generateTargetCells({ rng: createRng(SEED), roundIndex: 0, gridSize: NORMAL.gridSize, targetCount: NORMAL.initialTargetCount, prevTargets: null });
function event() { return { nativeEvent: { timestamp: 123, target: 1 } } as unknown as GestureResponderEvent; }
async function press(part: string) { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part))); }
function capture(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) { if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress as () => void; fiber = fiber.return; }
  throw new Error(`Missing actual ${part} callback`);
}
async function setup(autoStart = true) {
  const intervals = jest.spyOn(global, 'setInterval');
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  if (autoStart) await press('start');
  const ticker = () => {
    const callback = intervals.mock.calls.filter((call) => call[1] === 100).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error('Missing actual study interval');
    return callback as () => void;
  };
  const advance = async (ms: number) => { await act(async () => { clock.advance(ms); }); };
  const tick = async () => { await act(async () => ticker()()); };
  const input = async () => { await advance(NORMAL.studyMs); await act(async () => { jest.advanceTimersByTime(NORMAL.studyMs); }); };
  return { clock, ticker, advance, tick, input };
}
function selected(index: number) { return screen.getByTestId(testId(GAME_ID, 'cell', String(index))).props.accessibilityState.selected; }

describe('Grid Recall actual displayed input ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('ignores physical redelivery across commits but keeps a new intentional toggle', async () => {
    const { input } = await setup(); await input();
    const first = event();
    const cell = () => screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0])));
    await fireEvent(cell(), 'press', first);
    expect(selected(TARGETS[0])).toBe(true);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await fireEvent(cell(), 'press', { ...first, nativeEvent: first.nativeEvent });
    expect(selected(TARGETS[0])).toBe(true);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    await fireEvent(cell(), 'press', event());
    expect(selected(TARGETS[0])).toBe(false);
  });

  it('keeps distinct known selections and one submit in the same batch', async () => {
    const { input } = await setup(); await input();
    const tap = mockTap; const submit = capture('submit');
    await act(async () => { for (const index of TARGETS) tap(index, event()); submit(); submit(); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(jest.mocked(liveAudioHaptics.feedback).mock.calls.filter(([kind]) => kind === 'tap')).toHaveLength(TARGETS.length);
  });

  it('drops previous-round tap and submit callbacks on a later input board', async () => {
    const { input } = await setup(); await input();
    const oldTap = mockTap; const oldSubmit = capture('submit');
    await press('submit'); await press('next-round'); await input();
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => { oldTap(TARGETS[0], event()); oldSubmit(); });
    expect(screen.getByTestId(testId(GAME_ID, 'input-board'))).toBeOnTheScreen();
    expect(selected(TARGETS[0])).toBe(false);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('retires input immediately at pause and keeps pre-pause callbacks stale after resume', async () => {
    const { input } = await setup(); await input();
    const oldTap = mockTap; const oldSubmit = capture('submit');
    await act(async () => { mockHost.onPause(); oldTap(TARGETS[0], event()); oldSubmit(); });
    await press('resume');
    await act(async () => { oldTap(TARGETS[0], event()); oldSubmit(); });
    expect(screen.getByTestId(testId(GAME_ID, 'input-board'))).toBeOnTheScreen();
    expect(selected(TARGETS[0])).toBe(false);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('does not manufacture study time from early repeated callbacks', async () => {
    const { ticker } = await setup(); const queued = ticker();
    await act(async () => { for (let index = 0; index < 30; index += 1) queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'study-board'))).toBeOnTheScreen();
  });

  it('uses actual elapsed study time on one delayed callback', async () => {
    const { advance, tick } = await setup();
    await advance(NORMAL.studyMs); await tick();
    expect(screen.getByTestId(testId(GAME_ID, 'input-board'))).toBeOnTheScreen();
  });

  it('preserves a sub-tick pause remainder and cancels the old study ticker', async () => {
    const { ticker, advance, tick } = await setup(); const oldTick = ticker();
    await advance(333); await press('pause'); await advance(10_000); await press('resume');
    await advance(NORMAL.studyMs - 333);
    await act(async () => oldTick());
    expect(screen.getByTestId(testId(GAME_ID, 'study-board'))).toBeOnTheScreen();
    await tick();
    expect(screen.getByTestId(testId(GAME_ID, 'input-board'))).toBeOnTheScreen();
  });

  it('does not let a previous round study callback hide a new pattern', async () => {
    const { ticker, input } = await setup(); const oldTick = ticker(); await input();
    await press('submit'); await press('next-round');
    await act(async () => { for (let index = 0; index < 30; index += 1) oldTick(); });
    expect(screen.getByTestId(testId(GAME_ID, 'study-board'))).toBeOnTheScreen();
  });

  it('describes highlighted content only during its visible study phase', async () => {
    const { input } = await setup();
    expect(screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0]))).props.accessibilityLabel).toMatch(/highlighted/i);
    await input();
    expect(screen.getByTestId(testId(GAME_ID, 'cell', String(TARGETS[0]))).props.accessibilityLabel).not.toMatch(/highlighted|target|answer/i);
  });

  it('makes a queued input inert immediately after the session is abandoned', async () => {
    const { input } = await setup(); await input(); const tap = mockTap;
    await act(async () => { mockHost.onQuit(); tap(TARGETS[0], event()); });
    expect(selected(TARGETS[0])).toBe(false);
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('keeps duplicate native delivery from undoing a tutorial pattern pick', async () => {
    const clock = createFakeClock();
    await render(<GameScreen clock={clock} tutorialStore={createInMemoryTutorialStore()} />);
    await press('tutorial-next');
    await act(async () => { clock.advance(1500); jest.advanceTimersByTime(1500); });
    const targets = generateTargetCells({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, gridSize: 9, targetCount: 2, prevTargets: null });
    const first = event(); const cell = (index: number) => screen.getByTestId(testId(GAME_ID, 'cell', String(index)));
    await fireEvent(cell(targets[0]), 'press', first);
    await fireEvent(cell(targets[0]), 'press', { ...first, nativeEvent: first.nativeEvent });
    await fireEvent(cell(targets[1]), 'press', event());
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeOnTheScreen();
  });

  it('drops duplicate Start while active and while completion is queued', async () => {
    await setup(); const start = mockHost.onStart;
    await act(async () => start());
    const panel = mockHost.qaPanel as ReactElement<{ onForceLose: () => void }>;
    await act(async () => { panel.props.onForceLose(); start(); });
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
  });
  it('retires an intro Start across completion but accepts the newly rendered restart', async () => {
    await setup(false);
    const oldStart = capture('start');
    await press('start'); await press('qa-toggle'); await press('force-lose');
    await act(async () => oldStart());
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await press('restart');
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
  });

  it('claims Help before a retained same-batch Start can begin under the tutorial', async () => {
    await setup(false);
    const oldStart = capture('start');
    const help = capture('help');
    await act(async () => { help(); oldStart(); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await press('tutorial-skip');
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    await press('start');
    expect(screen.queryByTestId(testId(GAME_ID, 'intro'))).toBeNull();
  });

});
