import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';
import type { GameHostProps } from '@/components/game-host';

import { Playfield } from '../components/playfield';
import type { PlayfieldProps } from '../components/playfield';
import { tapRushGameReducer } from '../reducer';
import TapRushScreen from '../screen';
import { createInitialTapRushState, GAME_ID } from '../types';
import type { TapRushGameState } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

let mockRenderedOnTap: PlayfieldProps['onTap'];
let mockRenderedOnPause: GameHostProps['onPause'];
let mockRenderedOnStart: GameHostProps['onStart'];
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => {
    mockRenderedOnPause = props.onPause;
    mockRenderedOnStart = props.onStart;
    return React.createElement(actual.GameHost, props);
  } };
});
jest.mock('../components/playfield', () => {
  const actual = jest.requireActual<typeof import('../components/playfield')>('../components/playfield');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, Playfield: (props: PlayfieldProps) => {
    mockRenderedOnTap = props.onTap;
    return React.createElement(actual.Playfield, props);
  } };
});

const geometry = { width: 300, height: 300 };

function stamp(state: TapRushGameState) {
  return {
    sessionId: state.sessionId,
    roundIndex: state.roundIndex,
    targetIndex: state.targetIndex,
    inputEpoch: state.inputEpoch,
  };
}

function start() {
  return tapRushGameReducer(createInitialTapRushState(), {
    type: 'start-session', seed: '077-tap-rush', sessionId: '077', startedAtMs: 0, spawnedAtMs: 0,
  });
}

async function renderGame(level = 'normal', startCommitDelayMs = 0) {
  const clock = createFakeClock(0);
  const tutorialStore = createInMemoryTutorialStore();
  tutorialStore.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const result = await render(<TapRushScreen clock={clock} tutorialStore={tutorialStore} sessionSeed="077-tap-rush" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', level)));
  await act(async () => {
    mockRenderedOnStart();
    clock.advance(startCommitDelayMs);
  });
  await fireEvent(screen.getByTestId(testId(GAME_ID, 'field')), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, ...geometry } },
  });
  return { clock, result };
}

function renderedCenter(index: number) {
  const style = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'target', String(index))).props.style);
  return { x: parseFloat(style.left) / 100, y: parseFloat(style.top) / 100 };
}

async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => { clock.advance(ms); jest.advanceTimersByTime(ms); });
}

describe('Tap Rush target identity and rendered geometry regressions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolves a stamped target only once even when the same tap is replayed', () => {
    const state = start();
    const target = state.targets[0];
    const action = { type: 'tap' as const, ...target, nowMs: 200, stamp: stamp(state), geometry };
    const hit = tapRushGameReducer(state, action);
    expect(hit.targetIndex).toBe(1);
    expect(tapRushGameReducer(hit, action)).toBe(hit);
  });

  it('rejects an early expiry and an expiry from an already resolved target', () => {
    const state = start();
    const early = { type: 'target-expired' as const, nowMs: 1099, stamp: stamp(state) };
    expect(tapRushGameReducer(state, early)).toBe(state);
    const hit = tapRushGameReducer(state, {
      type: 'tap', ...state.targets[0], nowMs: 200, ...{ stamp: stamp(state), geometry },
    });
    const stale = { type: 'target-expired' as const, nowMs: 1300, stamp: stamp(state) };
    expect(tapRushGameReducer(hit, stale)).toBe(hit);
  });

  it('ignores taps before spawn and at the expired deadline', () => {
    const state = start();
    for (const nowMs of [-1, 1100]) {
      const action = { type: 'tap' as const, ...state.targets[0], nowMs, stamp: stamp(state), geometry };
      expect(tapRushGameReducer(state, action)).toBe(state);
    }
  });

  it('expires the deadline once and rejects the previous pause/session identity', () => {
    const state = start();
    const expiry = { type: 'target-expired' as const, nowMs: 1100, stamp: stamp(state) };
    const expired = tapRushGameReducer(state, expiry);
    expect(expired.stats.targetsMissed).toBe(1);
    expect(tapRushGameReducer(expired, expiry)).toBe(expired);
    const paused = tapRushGameReducer(state, { type: 'pause' });
    const resumed = tapRushGameReducer(paused, { type: 'resume', nowMs: 10000, remainingMs: 800 });
    const oldTap = { type: 'tap' as const, ...state.targets[0], nowMs: 10100, stamp: stamp(state), geometry };
    expect(tapRushGameReducer(resumed, oldTap)).toBe(resumed);
    const restarted = tapRushGameReducer(resumed, {
      type: 'start-session', seed: '077-tap-rush', sessionId: 'new-session', startedAtMs: 0, spawnedAtMs: 10100,
    });
    expect(tapRushGameReducer(restarted, oldTap)).toBe(restarted);
  });

  it('gives the next target its full window after a hit at 200 ms', async () => {
    const { clock } = await renderGame();
    await advance(clock, 200);
    const center = renderedCenter(0);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'field')), {
      nativeEvent: { locationX: center.x * 300, locationY: center.y * 300 },
    });
    await advance(clock, 900);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
    await advance(clock, 199);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '2'))).toBeOnTheScreen();
  });

  it('does not consume the unseen next target when the rendered handler fires twice before commit', async () => {
    const { clock } = await renderGame();
    await advance(clock, 200);
    const center = renderedCenter(0);
    const onTap = mockRenderedOnTap;
    await act(async () => {
      onTap(center.x, center.y, geometry);
      onTap(center.x, center.y, geometry);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'target', '2'))).toBeNull();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('drops a pre-pause rendered callback after resume without sound or target advancement', async () => {
    const { clock } = await renderGame();
    const oldTap = mockRenderedOnTap;
    const center = renderedCenter(0);
    await advance(clock, 300);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldTap(center.x, center.y, geometry); });
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await advance(clock, 799);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
  });

  it('keeps expiry aligned with the captured pause budget when the pause commit is delayed', async () => {
    const { clock } = await renderGame();
    await advance(clock, 300);
    await act(async () => {
      mockRenderedOnPause?.();
      // A busy JS turn delays effect cleanup after the pause handler captured
      // its remaining budget. Timer bookkeeping must not choose a shorter one.
      clock.advance(50);
    });
    await advance(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await advance(clock, 799);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
  });

  it('rounds a fractional remaining window up so native integer timers cannot strand a target', async () => {
    const { clock } = await renderGame('normal', 0.25);
    // Native Android timers and Jest both truncate fractional delays. At
    // 1099.25 ms a floor-rounded wakeup would fail the deadline guard forever.
    await advance(clock, 1099);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
    await advance(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
  });

  it('accepts an expert tap 19 dp from center inside the rendered platform touch circle', async () => {
    await renderGame('expert');
    const center = renderedCenter(0);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'field')), {
      nativeEvent: { locationX: center.x * 300 + 19, locationY: center.y * 300 },
    });
    expect(screen.getByTestId(testId(GAME_ID, 'verdict')).props.accessibilityLabel).toBe('Last tap: hit');
  });

  it('normalizes both measured axes and passes the actual field geometry to hit testing', async () => {
    const onTap = jest.fn();
    await render(<Playfield target={{ x: 0.5, y: 0.5 }} radius={0.05} testID="measured-field" onTap={onTap} />);
    await fireEvent(screen.getByTestId('measured-field'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 200 } },
    });
    await fireEvent.press(screen.getByTestId('measured-field'), { nativeEvent: { locationX: 150, locationY: 100 } });
    expect(onTap).toHaveBeenCalledWith(0.5, 0.5, { width: 300, height: 200 });
    expect(StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'target')).props.style)).toMatchObject({ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET });
  });

  it('ignores unmeasured, disabled and idle playfields', async () => {
    const onTap = jest.fn();
    const result = await render(<Playfield target={{ x: 0.5, y: 0.5 }} radius={0.05} testID="guarded-field" onTap={onTap} />);
    const event = { nativeEvent: { locationX: 150, locationY: 150 } };
    await fireEvent.press(screen.getByTestId('guarded-field'), event);
    await fireEvent(screen.getByTestId('guarded-field'), 'layout', { nativeEvent: { layout: geometry } });
    await result.rerender(<Playfield target={{ x: 0.5, y: 0.5 }} radius={0.05} disabled testID="guarded-field" onTap={onTap} />);
    await fireEvent.press(screen.getByTestId('guarded-field'), event);
    await result.rerender(<Playfield target={null} radius={0.05} testID="guarded-field" onTap={onTap} />);
    await fireEvent.press(screen.getByTestId('guarded-field'), event);
    expect(onTap).not.toHaveBeenCalled();
  });
});
