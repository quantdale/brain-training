import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import { Tutorial } from '../components/tutorial';
import { MEMORY_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundSequence } from '../generator';
import MemoryScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

const SEED = '077-memory-observed';

/** Read the tile the player actually sees, independently of the generated answer. */
function observedTile(gridId: string): number {
  const tiles = within(screen.getByTestId(gridId)).getAllByRole('button', { disabled: true });
  const lit = tiles.filter((tile) => StyleSheet.flatten(tile.props.style).opacity === 0.85);
  expect(lit).toHaveLength(1);
  return Number(lit[0].props.testID.split('.').at(-1));
}

/** Capture fireEvent's actual rendered handler before React can replace it. */
function capturePress(id: string): (event: GestureResponderEvent) => void {
  let fiber = screen.getByTestId(id).unstable_fiber;
  while (fiber !== null) {
    const handler = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler;
    fiber = fiber.return;
  }
  throw new Error(`Missing press handler: ${id}`);
}

function pressEvent(timestamp = 100): GestureResponderEvent {
  return { nativeEvent: { timestamp } } as GestureResponderEvent;
}

async function renderGame(level: 'normal' | 'hard' | 'expert' = 'normal') {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  await render(<MemoryScreen clock={clock} tutorialStore={store} sessionSeed={SEED} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', level)));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const params = MEMORY_DIFFICULTY_PARAMS[level];
  // Only the lifecycle tests use the hidden answer to isolate caller failures
  // from the independent displayed-path failures below.
  const answer = generateRoundSequence({ rng: createRng(SEED), roundIndex: 0, length: params.initialSequenceLength, gridSize: params.gridSize, prevSequence: null });
  const disabledPress = capturePress(testId(GAME_ID, 'tile', String(answer[0])));
  const shown: number[] = [];
  for (let step = 0; step < params.initialSequenceLength; step += 1) {
    shown.push(observedTile(testId(GAME_ID, 'reveal-grid')));
    await act(async () => { clock.advance(params.revealMs); jest.advanceTimersByTime(params.revealMs); });
  }
  return { clock, shown, answer, disabledPress };
}

async function observeTutorial(clock: ReturnType<typeof createFakeClock>) {
  const shown: number[] = [];
  for (let step = 0; step < 3; step += 1) {
    shown.push(observedTile(testId(GAME_ID, 'tutorial-grid')));
    await act(async () => { clock.advance(900); jest.advanceTimersByTime(900); });
  }
  return shown;
}

describe('Memory displayed sequence and delivered input', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each(['normal', 'hard', 'expert'] as const)('passes the live %s round by repeating only the tiles that lit up', async (level) => {
    const { shown } = await renderGame(level);
    for (const tile of shown) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
  });

  it('completes the tutorial by repeating only its lit tiles', async () => {
    const clock = createFakeClock(0);
    await render(<Tutorial clock={clock} onComplete={jest.fn()} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const shown = await observeTutorial(clock);
    for (const tile of shown) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('ignores copied tutorial input while accepting every distinct queued recall press immediately', async () => {
    const clock = createFakeClock(0);
    const onComplete = jest.fn();
    await render(<Tutorial clock={clock} onComplete={onComplete} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const shown = await observeTutorial(clock);
    const presses = shown.map((tile) => capturePress(testId(GAME_ID, 'tile', String(tile))));
    const first = pressEvent(100);
    await act(async () => {
      presses[0](first);
      presses[0]({ ...first });
      presses[1](pressEvent(100));
      presses[2](pressEvent(100));
    });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('retires a failed tutorial attempt before queued old callbacks reach the replay', async () => {
    const clock = createFakeClock(0);
    await render(<Tutorial clock={clock} onComplete={jest.fn()} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const shown = await observeTutorial(clock);
    const presses = shown.map((tile) => capturePress(testId(GAME_ID, 'tile', String(tile))));
    const wrongPress = capturePress(testId(GAME_ID, 'tile', String((shown[0] + 1) % 9)));
    await act(async () => {
      wrongPress(pressEvent());
      for (const press of presses) press(pressEvent());
    });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/Watch the sequence/);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
    const replay = await observeTutorial(clock);
    await act(async () => { for (const press of presses) press(pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/tap the 3 lit tiles/);
    for (const tile of replay) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('counts one native payload once even when its outer event is copied', async () => {
    const { answer } = await renderGame();
    const onPress = capturePress(testId(GAME_ID, 'tile', String(answer[0])));
    const event = pressEvent();
    await act(async () => { onPress(event); onPress({ ...event }); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^1 of /);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
  });

  it('accepts distinct known-sequence inputs in one batch at the same clock and timestamp', async () => {
    const { answer } = await renderGame('expert');
    const callbacks = answer.map((tile) => capturePress(testId(GAME_ID, 'tile', String(tile))));
    await act(async () => { for (const callback of callbacks) callback(pressEvent(100)); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(answer.length);
    answer.forEach((_, position) => expect(liveAudioHaptics.playSfx).toHaveBeenNthCalledWith(position + 1, 'memory-tile-correct'));
  });

  it('rejects a rendered reveal handler delivered only after input becomes active', async () => {
    const { answer, disabledPress } = await renderGame();
    await act(async () => { disabledPress(pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^0 of /);
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(answer[0]))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^1 of /);
  });

  it('rejects a pre-pause input handler after resume and accepts a fresh handler', async () => {
    const { answer } = await renderGame();
    const oldPress = capturePress(testId(GAME_ID, 'tile', String(answer[0])));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldPress(pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^0 of /);
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(answer[0]))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel).toMatch(/^1 of /);
  });

  it('ignores a cancelled reveal wakeup until the resumed tile reaches its exact exposure deadline', async () => {
    const clock = createFakeClock(0);
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    const scheduled = jest.spyOn(global, 'setTimeout');
    await render(<MemoryScreen clock={clock} tutorialStore={store} sessionSeed={SEED} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const firstTile = observedTile(testId(GAME_ID, 'reveal-grid'));
    const oldWakeup = scheduled.mock.calls.filter(([, ms]) => ms === 900).at(-1)![0] as () => void;
    await act(async () => { clock.advance(100); jest.advanceTimersByTime(100); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    clock.advance(10000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldWakeup(); });
    expect(observedTile(testId(GAME_ID, 'reveal-grid'))).toBe(firstTile);
    await act(async () => { clock.advance(799); jest.advanceTimersByTime(799); });
    expect(observedTile(testId(GAME_ID, 'reveal-grid'))).toBe(firstTile);
    await act(async () => { clock.advance(1); jest.advanceTimersByTime(1); });
    expect(observedTile(testId(GAME_ID, 'reveal-grid'))).not.toBe(firstTile);
  });
});
