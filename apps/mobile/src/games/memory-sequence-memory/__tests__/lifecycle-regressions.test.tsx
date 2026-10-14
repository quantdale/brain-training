import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import type { SequencePadProps } from '../components/pad';
import { generateSequence } from '../generator';
import SequenceMemoryScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

let mockRenderedOnPressTile: SequencePadProps['onPressTile'];
jest.mock('../components/pad', () => {
  const actual = jest.requireActual<typeof import('../components/pad')>('../components/pad');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, SequencePad: (props: SequencePadProps) => {
    mockRenderedOnPressTile = props.onPressTile;
    return React.createElement(actual.SequencePad, props);
  } };
});

function pressEvent(timestamp = 100): GestureResponderEvent {
  return { nativeEvent: { timestamp } } as GestureResponderEvent;
}

const SEED = '077-sequence-lifecycle';

async function setup(tutorial = false) {
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  if (!tutorial) store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<SequenceMemoryScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  if (!tutorial) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return { clock, completeSession };
}

function litPad(): number {
  const lit = [0, 1, 2, 3].filter((index) => {
    const tile = screen.getByTestId(testId(GAME_ID, 'tile', String(index)));
    const style = typeof tile.props.style === 'function' ? tile.props.style({ pressed: false }) : tile.props.style;
    return StyleSheet.flatten(style).opacity !== 0.4;
  });
  expect(lit).toHaveLength(1);
  return lit[0];
}

async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => { clock.advance(ms); jest.advanceTimersByTime(ms); });
}

describe('Sequence Memory observed state and lifecycle callbacks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('does not finish or persist from a queued countdown callback while paused', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const { clock, completeSession } = await setup();
    const queued = intervals.mock.calls.find((call) => call[1] === 250)?.[0];
    expect(typeof queued).toBe('function');
    // Expiry and pause may race before the native interval callback reaches JS.
    await act(async () => { clock.advance(90_000); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
    expect(completeSession).not.toHaveBeenCalled();
  });

  it('shows the generated tile identity at every live reveal step and accepts the observed sequence', async () => {
    const { clock } = await setup();
    const expected = generateSequence({ rng: createRng(SEED), sequenceIndex: 0, length: 3, tileCount: 4, prevSequence: null });
    const observed: number[] = [];
    for (let step = 0; step < expected.length; step += 1) {
      observed.push(litPad());
      await advance(clock, 900);
    }
    expect(observed).toEqual(expected);
    for (const tile of observed) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(observed.length);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(observed.length);
  });

  it('shows the actual generated tutorial sequence before asking the player to repeat it', async () => {
    const { clock } = await setup(true);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const expected = generateSequence({ rng: createRng(TUTORIAL_DEMO_SEED), sequenceIndex: 0, length: 3, tileCount: 4, prevSequence: null });
    const observed: number[] = [];
    for (let step = 0; step < expected.length; step += 1) {
      observed.push(litPad());
      await advance(clock, 900);
    }
    expect(observed).toEqual(expected);
    for (const tile of observed) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('does not score a late input before the delayed countdown next runs', async () => {
    const { clock, completeSession } = await setup();
    for (let step = 0; step < 3; step += 1) await advance(clock, 900);
    const expected = generateSequence({ rng: createRng(SEED), sequenceIndex: 0, length: 3, tileCount: 4, prevSequence: null });
    await act(async () => { clock.advance(90_000 - clock.now()); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(expected[0]))));
    expect(screen.queryByLabelText(`Correct: Pad ${expected[0] + 1}`)).toBeNull();
    expect(completeSession.mock.calls[0][0].session.rawResult).toMatchObject({ score: 0, roundsPassed: 0, timeUp: true });
    expect(completeSession.mock.calls[0][0].session.durationMs).toBe(90_000);
  });

  it('accepts separate rapid presses of the observed sequence before React commits', async () => {
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    const press = mockRenderedOnPressTile;
    await act(async () => {
      for (const [step, tile] of observed.entries()) press(tile, pressEvent(100 + step));
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('does not consume a sequence step twice for the same native event payload', async () => {
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    const press = mockRenderedOnPressTile;
    const event = pressEvent();
    await act(async () => { press(observed[0], event); press(observed[0], { ...event }); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '1 of 3 matched');
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('drops a disabled reveal-pad callback delivered after input becomes active', async () => {
    const { clock } = await setup();
    const revealPress = mockRenderedOnPressTile;
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    await act(async () => { revealPress(observed[0], pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '0 of 3 matched');
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(observed[0]))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '1 of 3 matched');
  });

  it('rejects a pre-pause input callback after resume while accepting the newly rendered input', async () => {
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    const oldPress = mockRenderedOnPressTile;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldPress(observed[0], pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '0 of 3 matched');
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(observed[0]))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '1 of 3 matched');
  });

  it('judges a distinct second physical press on the previous tile as a mistake', async () => {
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    expect(observed[0]).not.toBe(observed[1]); // This generator suppresses adjacent repeats.
    const press = mockRenderedOnPressTile;
    await act(async () => { press(observed[0], pressEvent(100)); press(observed[0], pressEvent(101)); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenNthCalledWith(2, 'memory-sequence-memory-tile-wrong');
  });

  it('does not skip a reveal position from a queued tick after pause or consume paused reveal time', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const { clock } = await setup();
    const firstTile = litPad();
    const queued = timers.mock.calls.filter((call) => call[1] === 900).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    await advance(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(litPad()).toBe(firstTile);
    await advance(clock, 499);
    expect(litPad()).toBe(firstTile);
    await advance(clock, 1);
    expect(litPad()).not.toBe(firstTile);
  });

  it('drops a previous round input callback on the next round', async () => {
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    const oldPress = mockRenderedOnPressTile;
    for (const tile of observed) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    const first = litPad();
    for (let step = 0; step < 4; step += 1) await advance(clock, 900);
    await act(async () => { oldPress(first, pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '0 of 4 matched');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(first))));
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '1 of 4 matched');
  });

  it('drops an old-session input and countdown callback after Play again', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const { clock } = await setup();
    const observed: number[] = [];
    for (let step = 0; step < 3; step += 1) { observed.push(litPad()); await advance(clock, 900); }
    const oldPress = mockRenderedOnPressTile;
    const queued = intervals.mock.calls.filter((call) => call[1] === 250).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    for (let step = 0; step < 3; step += 1) await advance(clock, 900);
    await act(async () => { oldPress(observed[0], pressEvent()); });
    expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toHaveProp('accessibilityLabel', '0 of 3 matched');
    // Only the new session's ticker may update its countdown display.
    const before = screen.getByTestId(testId(GAME_ID, 'countdown')).props.children;
    await act(async () => { clock.advance(1000); if (typeof queued === 'function') queued(); });
    expect(screen.getByTestId(testId(GAME_ID, 'countdown')).props.children).toEqual(before);
  });
});
