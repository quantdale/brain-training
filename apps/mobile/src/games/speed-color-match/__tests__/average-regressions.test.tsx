import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';

import type { ColorButtonGridProps } from '../components/color-button';
import { generateTrials } from '../generator';
import { SPEED_COLOR_MATCH_DIFFICULTY_PARAMS } from '../difficulty';
import SpeedColorMatchScreen from '../screen';
import { COLOR_PALETTE, GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

let mockRenderedColorPress: ColorButtonGridProps['onPress'];
jest.mock('../components/color-button', () => {
  const actual = jest.requireActual<typeof import('../components/color-button')>('../components/color-button');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, ColorButtonGrid: (props: ColorButtonGridProps) => {
    mockRenderedColorPress = props.onPress;
    return React.createElement(actual.ColorButtonGrid, props);
  } };
});

async function setup(seed = '077-color-lifecycle') {
  const clock = createFakeClock();
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
  }));
  await render(<SpeedColorMatchScreen clock={clock} tutorialStore={store} sessionSeed={seed} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const trials = generateTrials({ rng: createRng(seed), totalTrials: 15, incongruentCount: 3 });
  return { clock, completeSession, trials };
}

async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => { clock.advance(ms); jest.advanceTimersByTime(ms); });
}

describe('Color Match correct-response averages through the real screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(liveAudioHaptics, 'playSfx').mockImplementation(() => {});
    jest.spyOn(liveAudioHaptics, 'haptic').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('keeps an old timeout inert after a pause resumes the same trial', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const clock = createFakeClock();
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<SpeedColorMatchScreen clock={clock} tutorialStore={store} sessionSeed="077-color-timeout" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const timeoutMs = SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.normal.stimulusTimeoutMs;
    const queued = timers.mock.calls.filter((call) => call[1] === timeoutMs).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    await act(async () => { clock.advance(400); jest.advanceTimersByTime(400); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await act(async () => { clock.advance(10_000); jest.advanceTimersByTime(10_000); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { if (typeof queued === 'function') queued(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-trial'))).toBeNull();
    await act(async () => { clock.advance(timeoutMs - 400); jest.advanceTimersByTime(timeoutMs - 400); });
    expect(screen.getByTestId(testId(GAME_ID, 'next-trial'))).toBeOnTheScreen();
  });

  it('rejects a correct response at the exact stimulus deadline', async () => {
    const seed = '077-color-deadline';
    const clock = createFakeClock();
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<SpeedColorMatchScreen clock={clock} tutorialStore={store} sessionSeed={seed} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const [trial] = generateTrials({ rng: createRng(seed), totalTrials: 15, incongruentCount: 3 });
    await act(async () => { clock.advance(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy.stimulusTimeoutMs); });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', trial.swatchColor)));
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    expect(liveAudioHaptics.haptic).not.toHaveBeenCalled();
  });

  it.each([false, true])('excludes wrong responses regardless of whether the wrong response came first: %s', async (wrongFirst) => {
    const seed = '077-color-average';
    const clock = createFakeClock();
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
    await render(<SpeedColorMatchScreen clock={clock} tutorialStore={store} sessionSeed={seed} persistSession={{ completeSession }} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const trials = generateTrials({ rng: createRng(seed), totalTrials: 15, incongruentCount: 3 });
    for (let i = 0; i < trials.length; i += 1) {
      await act(async () => { clock.advance(400); });
      const correct = i === (wrongFirst ? 1 : 0);
      const color = correct ? trials[i].swatchColor : COLOR_PALETTE.find((value) => value !== trials[i].swatchColor)!;
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', color)));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    }
    await act(async () => {});
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession.mock.calls[0][0].session.rawResult).toMatchObject({ trialsCorrect: 1, trialsPlayed: 15, avgReactionMs: 400 });
  });

  it('claims a rendered trial once when its handler is delivered twice before React commits', async () => {
    const { clock, trials } = await setup();
    await advance(clock, 200);
    const press = mockRenderedColorPress;
    await act(async () => { press(trials[0].swatchColor); press(trials[0].swatchColor); });
    expect(screen.getByTestId(testId(GAME_ID, 'trial-correct'))).toBeOnTheScreen();
    expect(screen.getByText('200ms')).toBeOnTheScreen();
    expect(liveAudioHaptics.playSfx).toHaveBeenCalledTimes(1);
    expect(liveAudioHaptics.haptic).toHaveBeenCalledTimes(1);
  });

  it('drops a previous trial input and timeout when the next stimulus is active', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const { clock, trials } = await setup();
    const timeoutMs = SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy.stimulusTimeoutMs;
    const queued = timers.mock.calls.filter((call) => call[1] === timeoutMs).at(-1)?.[0];
    expect(typeof queued).toBe('function');
    const oldPress = mockRenderedColorPress;
    await advance(clock, 200);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', trials[0].swatchColor)));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    jest.mocked(liveAudioHaptics.playSfx).mockClear();
    await act(async () => { oldPress(trials[1].swatchColor); if (typeof queued === 'function') queued(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-trial'))).toBeNull();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await advance(clock, timeoutMs - 1);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', trials[1].swatchColor)));
    expect(screen.getByTestId(testId(GAME_ID, 'trial-correct'))).toBeOnTheScreen();
  });

  it('rejects a pre-pause input after resume and measures only active response time', async () => {
    const { clock, trials } = await setup();
    const oldPress = mockRenderedColorPress;
    await advance(clock, 400);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advance(clock, 10_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => { oldPress(trials[0].swatchColor); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-trial'))).toBeNull();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', trials[0].swatchColor)));
    expect(screen.getByText('400ms')).toBeOnTheScreen();
  });

  it('drops an old-session input and timeout after Play again', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const { clock, trials } = await setup();
    const oldPress = mockRenderedColorPress;
    const timeoutMs = SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy.stimulusTimeoutMs;
    const queued = timers.mock.calls.filter((call) => call[1] === timeoutMs).at(-1)?.[0];
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await advance(clock, 100);
    await act(async () => { oldPress(trials[0].swatchColor); if (typeof queued === 'function') queued(); });
    expect(screen.queryByTestId(testId(GAME_ID, 'next-trial'))).toBeNull();
    expect(liveAudioHaptics.playSfx).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', trials[0].swatchColor)));
    expect(screen.getByText('100ms')).toBeOnTheScreen();
  });

  it('averages all correct samples when wrong responses and missed trials separate them', async () => {
    const { clock, completeSession, trials } = await setup('077-color-multiple-samples');
    for (let i = 0; i < trials.length; i += 1) {
      if (i === 2) {
        await advance(clock, SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy.stimulusTimeoutMs);
      } else {
        await advance(clock, i === 0 ? 200 : 600);
        const color = i === 0 || i === 3 ? trials[i].swatchColor : COLOR_PALETTE.find((value) => value !== trials[i].swatchColor)!;
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', color)));
      }
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    }
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession.mock.calls[0][0].session.rawResult).toMatchObject({
      trialsCorrect: 2, trialsPlayed: 15, avgReactionMs: 400, fastestReactionMs: 200, slowestReactionMs: 600,
      gameVersion: '1.1.0', generatorVersion: '1.0.0', scoringVersion: '1.2.0',
    });
    expect(screen.getByTestId(testId(GAME_ID, 'avg-reaction'))).toHaveTextContent('400ms');
  });
});
