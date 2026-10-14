import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import type { GameHostProps } from '@/components/game-host';
import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';
import { VISUAL_SEARCH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundTarget, generateSessionTargets } from '../generator';
import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import GameScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
let mockHost: GameHostProps;
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => { mockHost = props; return React.createElement(actual.GameHost, props); } };
});
const NORMAL = VISUAL_SEARCH_DIFFICULTY_PARAMS.normal;
const SEED = '077-search-input';
const TARGETS = generateSessionTargets(SEED, NORMAL);
function event() { return { nativeEvent: { timestamp: 123, target: 1 } } as unknown as GestureResponderEvent; }
async function press(part: string, index = '') { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part, index))); }
function capture(part: string, index = '') {
  let fiber = screen.getByTestId(testId(GAME_ID, part, index)).unstable_fiber;
  while (fiber !== null) { if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress as (event?: GestureResponderEvent) => void; fiber = fiber.return; }
  throw new Error(`Missing actual ${part} callback`);
}
async function setup(autoStart = true) {
  const intervals = jest.spyOn(global, 'setInterval'); const clock = createFakeClock();
  const store = createInMemoryTutorialStore(); store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />); if (autoStart) await press('start');
  const ticker = () => {
    const callback = intervals.mock.calls.filter((call) => call[1] === 100).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error('Missing actual search ticker'); return callback as () => void;
  };
  const advance = async (ms: number) => { await act(async () => { clock.advance(ms); }); };
  return { clock, ticker, advance };
}

describe('Visual Search rendered board and measured onset', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {}); jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('claims a rendered target once per batch, including its sensory feedback', async () => {
    await setup(); const tap = capture('tile', String(TARGETS[0]));
    await act(async () => { tap(event()); tap(event()); });
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('rejects a previously rendered tile handler when another round is visible', async () => {
    await setup(); const old = capture('tile', String(TARGETS[0]));
    await press('tile', String(TARGETS[0])); await press('next-round');
    jest.mocked(liveAudioHaptics.playSfx).mockClear(); jest.mocked(liveAudioHaptics.haptic).mockClear();
    await act(async () => old(event()));
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled(); expect(liveAudioHaptics.haptic).not.toHaveBeenCalled();
  });

  it('deduplicates a native payload even when redelivered through a fresh tile handler', async () => {
    await setup(); const first = event();
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'tile', String(TARGETS[0]))), 'press', first); await press('next-round');
    jest.mocked(liveAudioHaptics.playSfx).mockClear();
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'tile', String(TARGETS[1]))), 'press', { ...first, nativeEvent: first.nativeEvent });
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await press('tile', String(TARGETS[1])); expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('gives a new board its full response window after time spent on the preceding result without poll delivery', async () => {
    const { advance } = await setup(); await press('tile', String(TARGETS[0])); await advance(10_000); await press('next-round');
    await advance(1); await press('tile', String(TARGETS[1]));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('measures onset at delayed display commit, while preserving the total score-attack budget', async () => {
    const { advance, clock } = await setup(); await press('tile', String(TARGETS[0])); const next = capture('next-round');
    await advance(1000); await act(async () => { next(); clock.advance(5000); });
    await advance(1); await press('tile', String(TARGETS[1]));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('checks current score-attack eligibility before advancing from a result', async () => {
    const { advance } = await setup(); await press('tile', String(TARGETS[0])); await advance(NORMAL.sessionDurationMs); await press('next-round');
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'play-status'))).toBeNull();
  });

  it('retires a preceding round ticker even after the new round deadline passes', async () => {
    const { ticker, advance } = await setup(); const old = ticker();
    await press('tile', String(TARGETS[0])); await press('next-round'); await advance(NORMAL.initialWindowMs);
    await act(async () => old());
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    await act(async () => ticker()()); expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
  });

  it('retires rendered input immediately across pause, resume and abandonment', async () => {
    await setup(); const old = capture('tile', String(TARGETS[0]));
    await act(async () => { mockHost.onPause(); old(event()); }); await press('resume');
    await act(async () => old(event()));
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    const current = capture('tile', String(TARGETS[0])); await act(async () => { mockHost.onQuit(); current(event()); });
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
  });

  it('describes the visible color distinction without announcing target or correctness', async () => {
    await setup();
    const target = screen.getByTestId(testId(GAME_ID, 'tile', String(TARGETS[0]))).props.accessibilityLabel;
    const otherIndex = (TARGETS[0] + 1) % 9;
    const other = screen.getByTestId(testId(GAME_ID, 'tile', String(otherIndex))).props.accessibilityLabel;
    expect(target).toMatch(/orange/i); expect(other).toMatch(/white|dark blue/i);
    expect(target).not.toMatch(/target|answer|odd|correct/i);
  });

  it('does not let an unmounted tutorial attempt complete its replacement', async () => {
    await render(<GameScreen clock={createFakeClock()} tutorialStore={createInMemoryTutorialStore()} />); await press('tutorial-next');
    const target = generateRoundTarget({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, gridSize: 4, prevTargetIndex: null });
    const oldCorrect = capture('tile', String(target)); await press('tile', String((target + 1) % 4));
    await act(async () => oldCorrect(event()));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-grid'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
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
