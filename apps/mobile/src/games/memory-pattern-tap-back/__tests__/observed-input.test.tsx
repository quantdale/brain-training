import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';

import type { TileGridProps } from '../components/grid';
import { Tutorial } from '../components/tutorial';
import { DIFFICULTY_PARAMS } from '../difficulty';
import { gameReducer } from '../reducer';
import PatternTapBackScreen from '../screen';
import { createInitialState, GAME_ID, observationStamp, recallStamp } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

let mockRenderedOnPressTile: TileGridProps['onPressTile'];
jest.mock('../components/grid', () => {
  const actual = jest.requireActual<typeof import('../components/grid')>('../components/grid');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, TileGrid: (props: TileGridProps) => {
    mockRenderedOnPressTile = props.onPressTile;
    return React.createElement(actual.TileGrid, props);
  } };
});

/** Read the stimulus from the real tile fill/opacity, never the generator answer. */
function observedTile(gridId: string): number {
  const tiles = within(screen.getByTestId(gridId)).getAllByRole('button', { disabled: true });
  const lit = tiles.filter((tile) => StyleSheet.flatten(tile.props.style).opacity === 0.85);
  expect(lit).toHaveLength(1);
  return Number(lit[0].props.testID.split('.').at(-1));
}

function pressEvent(timestamp = 100): GestureResponderEvent {
  return { nativeEvent: { timestamp } } as GestureResponderEvent;
}

async function renderGame(level: 'normal' | 'hard' | 'expert') {
  const clock = createFakeClock(0);
  const tutorialStore = createInMemoryTutorialStore();
  tutorialStore.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const result = await render(<PatternTapBackScreen clock={clock} tutorialStore={tutorialStore} sessionSeed="077-observed-path" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', level)));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const params = DIFFICULTY_PARAMS[level];
  const observingCallback = mockRenderedOnPressTile;
  const shown: number[] = [];
  for (let step = 0; step < params.initialSequenceLength; step += 1) {
    shown.push(observedTile(testId(GAME_ID, 'observe-grid')));
    const ms = params.baseObserveMs + params.stepObserveMs * step;
    await act(async () => { clock.advance(ms); jest.advanceTimersByTime(ms); });
  }
  return { clock, shown, result, observingCallback };
}

describe('Pattern Tap Back presented-path and nonblocking recall regressions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lets a player complete the tutorial by following the lit tiles', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const shown: number[] = [];
    for (let step = 0; step < 3; step += 1) {
      shown.push(observedTile(testId(GAME_ID, 'tutorial-grid')));
      await act(async () => { jest.advanceTimersByTime(600); });
    }
    expect(shown).toEqual([3, 1, 2]);
    await act(async () => {
      for (const index of shown) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(index))));
    });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it.each(['normal', 'hard', 'expert'] as const)('accepts the displayed %s path with taps only 40 ms apart', async (level) => {
    const { clock, shown } = await renderGame(level);
    for (const index of shown) {
      const tile = screen.getByTestId(testId(GAME_ID, 'tile', String(index)));
      expect(tile).toBeEnabled();
      await fireEvent.press(tile);
      await act(async () => { clock.advance(40); jest.advanceTimersByTime(40); });
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('rejects a replay of a stamped recall slot while allowing the next input during feedback', () => {
    let state = gameReducer(createInitialState(), { type: 'start-session', seed: '077', sessionId: '077', startedAtMs: 0 });
    for (let i = 0; i < state.length; i += 1) state = gameReducer(state, { type: 'observe-tick', stamp: observationStamp(state) });
    const stamp = { sessionId: state.sessionId, roundIndex: state.roundIndex, inputIndex: 0, inputEpoch: state.inputEpoch };
    const tap = { type: 'tap-tile' as const, index: state.sequence[0], stamp };
    const first = gameReducer(state, tap);
    expect(gameReducer(first, tap)).toBe(first);
    const nextTap = { type: 'tap-tile' as const, index: state.sequence[1], stamp: { ...stamp, inputIndex: 1 } };
    expect(gameReducer(first, nextTap).inputIndex).toBe(2);
  });

  it('drops stale observe/highlight/pause stamps without suppressing a current recall input', () => {
    let state = gameReducer(createInitialState(), { type: 'start-session', seed: '077', sessionId: '077', startedAtMs: 0 });
    const oldTick = { type: 'observe-tick' as const, stamp: observationStamp(state) };
    state = gameReducer(state, oldTick);
    expect(gameReducer(state, oldTick)).toBe(state);
    while (state.phase === 'observe') state = gameReducer(state, { type: 'observe-tick', stamp: observationStamp(state) });
    const oldInput = { type: 'tap-tile' as const, index: state.sequence[0], stamp: recallStamp(state) };
    state = gameReducer(state, { type: 'pause' });
    state = gameReducer(state, { type: 'resume' });
    expect(gameReducer(state, oldInput)).toBe(state);
    state = gameReducer(state, { type: 'tap-tile', index: state.sequence[0], stamp: recallStamp(state) });
    const oldClear = { type: 'recall-tick' as const, stamp: recallStamp(state) };
    state = gameReducer(state, { type: 'tap-tile', index: state.sequence[1], stamp: recallStamp(state) });
    expect(state.recallHighlight).toBe(true);
    expect(gameReducer(state, oldClear)).toBe(state);
    expect(gameReducer(state, { type: 'recall-tick', stamp: recallStamp(state) }).recallHighlight).toBe(false);
  });

  it('keeps sound and progress single-counted when one rendered handler is delivered twice', async () => {
    const { shown } = await renderGame('normal');
    const onPressTile = mockRenderedOnPressTile;
    const nativeEvent = pressEvent();
    await act(async () => { onPressTile(shown[0], nativeEvent); onPressTile(shown[0], { ...nativeEvent }); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^1 of /);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('accepts two distinct queued native presses before React commits the recall cursor', async () => {
    const { shown } = await renderGame('expert');
    await act(async () => {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[0]))), { nativeEvent: { timestamp: 100 } });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[1]))), { nativeEvent: { timestamp: 101 } });
    });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^2 of /);
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(2);
  });

  it('judges a distinct physical second press on the previous tile instead of dropping it', async () => {
    const { shown } = await renderGame('normal');
    expect(new Set(shown).size).toBe(shown.length); // This generator never repeats a tile within a round.
    await act(async () => {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[0]))), { nativeEvent: { timestamp: 100 } });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[0]))), { nativeEvent: { timestamp: 101 } });
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenNthCalledWith(2, 'memory-tile-wrong');
  });

  it('drops a disabled observation callback delivered after recall becomes active', async () => {
    const { shown, observingCallback } = await renderGame('hard');
    await act(async () => { observingCallback(shown[0], pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^0 of /);
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
  });

  it('judges a wrong next tap during visible feedback immediately', async () => {
    const { shown } = await renderGame('normal');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[0]))));
    const wrong = (shown[1] + 1) % DIFFICULTY_PARAMS.normal.gridSize;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrong))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenNthCalledWith(1, 'memory-tile-correct');
    expect(liveAudioHaptics.playSfx).toHaveBeenNthCalledWith(2, 'memory-tile-wrong');
  });

  it('drops a pre-pause callback after resume and then accepts the newly rendered slot', async () => {
    const { shown } = await renderGame('hard');
    const oldTap = mockRenderedOnPressTile;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldTap(shown[0], pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^0 of /);
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(shown[0]))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^1 of /);
  });
});
