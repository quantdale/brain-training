import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ComponentType } from 'react';

import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';

import CoordinateScreen from '../screen';
import type { SpatialCoordinateTurnScreenProps } from '../screen';
import { gameReducer as coordinateReducer, createInitialSpatialCoordinateTurnState } from '../reducer';
import GridScreen from '../../spatial-grid-nav/screen';
import { gameReducer as gridReducer, createInitialState as createGridState } from '../../spatial-grid-nav/reducer';
import MentalScreen from '../../spatial-mental-rotation/screen';
import { spatialGameReducer as mentalReducer, createInitialSpatialState } from '../../spatial-mental-rotation/reducer';
import FoldScreen from '../../spatial-fold-match/screen';
import { gameReducer as foldReducer, createInitialSpatialFoldMatchState } from '../../spatial-fold-match/reducer';
import TransformScreen from '../../spatial-transform-match/screen';
import { gameReducer as transformReducer, createInitialState as createTransformState } from '../../spatial-transform-match/reducer';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
}));

// Observe the real rendered callers while retaining their real UI. Native
// Pressable's host View does not expose onPress in the test renderer.
const mockPressCallbacks = new Map<string, () => void>();
jest.mock('../components/compass', () => {
  const actual = jest.requireActual<typeof import('../components/compass')>('../components/compass');
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    OptionArrow: (props: ComponentProps<typeof actual.OptionArrow>) => {
      if (props.onPress) mockPressCallbacks.set(`spatial-coordinate-turn.option.${props.index}`, props.onPress);
      return React.createElement(actual.OptionArrow, props);
    },
    OptionCoord: (props: ComponentProps<typeof actual.OptionCoord>) => {
      if (props.onPress) mockPressCallbacks.set(`spatial-coordinate-turn.option.${props.index}`, props.onPress);
      return React.createElement(actual.OptionCoord, props);
    },
  };
});
jest.mock('../../spatial-grid-nav/components/grid', () => {
  const actual = jest.requireActual<typeof import('../../spatial-grid-nav/components/grid')>('../../spatial-grid-nav/components/grid');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, OptionCell: (props: ComponentProps<typeof actual.OptionCell>) => {
    if (props.onPress) mockPressCallbacks.set(`spatial-grid-nav.option.${props.index}`, props.onPress);
    return React.createElement(actual.OptionCell, props);
  } };
});
jest.mock('../../spatial-mental-rotation/components/button', () => {
  const actual = jest.requireActual<typeof import('../../spatial-mental-rotation/components/button')>('../../spatial-mental-rotation/components/button');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, AnswerButton: (props: ComponentProps<typeof actual.AnswerButton>) => {
    if (props.onPressAnswer) mockPressCallbacks.set(props.testID, () => props.onPressAnswer?.(props.answer));
    return React.createElement(actual.AnswerButton, props);
  } };
});
jest.mock('../../spatial-fold-match/components/option-grid', () => {
  const actual = jest.requireActual<typeof import('../../spatial-fold-match/components/option-grid')>('../../spatial-fold-match/components/option-grid');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, OptionGrid: (props: ComponentProps<typeof actual.OptionGrid>) => {
    if (props.onPressOption) mockPressCallbacks.set(`spatial-fold-match.option.${props.index}`, () => props.onPressOption?.(props.index));
    return React.createElement(actual.OptionGrid, props);
  } };
});
jest.mock('../../spatial-transform-match/components/option-button', () => {
  const actual = jest.requireActual<typeof import('../../spatial-transform-match/components/option-button')>('../../spatial-transform-match/components/option-button');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, OptionButton: (props: ComponentProps<typeof actual.OptionButton>) => {
    if (props.onPressOption) mockPressCallbacks.set(`spatial-transform-match.option.${props.index}`, () => props.onPressOption?.(props.index));
    return React.createElement(actual.OptionButton, props);
  } };
});

const SEED = '077-spatial-active-clock';
const START = { type: 'start-session' as const, seed: SEED, sessionId: 'plan', startedAtMs: 0 };
const coordinate = coordinateReducer(createInitialSpatialCoordinateTurnState(), START);
const grid = gridReducer(createGridState(), START);
const mental = mentalReducer(createInitialSpatialState(), START);
const fold = foldReducer(createInitialSpatialFoldMatchState(), START);
const transform = transformReducer(createTransformState(), START);

interface Fixture {
  id: string;
  Screen: ComponentType<SpatialCoordinateTurnScreenProps>;
  revealMs: number;
  pick: string;
  resultPhase: string;
  finish: string;
}

const fixtures: Fixture[] = [
  { id: 'spatial-coordinate-turn', Screen: CoordinateScreen, revealMs: -1, pick: `option.${coordinate.round!.correctIndex}`, resultPhase: 'round-result', finish: 'qa-force-timeout' },
  { id: 'spatial-grid-nav', Screen: GridScreen, revealMs: 0, pick: `option.${grid.round!.correctIndex}`, resultPhase: 'round-result', finish: 'qa-force-timeout' },
  { id: 'spatial-mental-rotation', Screen: MentalScreen, revealMs: 0, pick: mental.kind!, resultPhase: 'round-result', finish: 'force-timeout' },
  { id: 'spatial-fold-match', Screen: FoldScreen, revealMs: 1300, pick: `option.${fold.correctOptionIndex}`, resultPhase: 'round-result', finish: 'force-lose' },
  { id: 'spatial-transform-match', Screen: TransformScreen, revealMs: 1500, pick: `option.${transform.correctOptionIndex}`, resultPhase: 'round-result', finish: 'force-lose' },
];

const pausedFeedbackTransitions = [
  { id: 'spatial-coordinate-turn', run: () => {
    const choosing = coordinateReducer(coordinate, { type: 'next-round' });
    const answered = coordinateReducer(choosing, { type: 'select-answer', index: coordinate.round!.correctIndex, answerMs: 100 });
    const paused = coordinateReducer(answered, { type: 'pause' });
    return { paused, next: coordinateReducer(paused, { type: 'next-round' }) };
  } },
  { id: 'spatial-grid-nav', run: () => {
    const answered = gridReducer(grid, { type: 'pick-cell', index: grid.round!.correctIndex, responseMs: 100 });
    const paused = gridReducer(answered, { type: 'pause' });
    return { paused, next: gridReducer(paused, { type: 'next-round' }) };
  } },
  { id: 'spatial-mental-rotation', run: () => {
    const answered = mentalReducer(mental, { type: 'answer', answer: mental.kind! });
    const paused = mentalReducer(answered, { type: 'pause' });
    return { paused, next: mentalReducer(paused, { type: 'next-round', roundStartedElapsedMs: 100 }) };
  } },
  { id: 'spatial-fold-match', run: () => {
    const choosing = foldReducer(fold, { type: 'source-tick' });
    const answered = foldReducer(choosing, { type: 'select-option', index: fold.correctOptionIndex, answerMs: 100 });
    const paused = foldReducer(answered, { type: 'pause' });
    return { paused, next: foldReducer(paused, { type: 'next-round' }) };
  } },
  { id: 'spatial-transform-match', run: () => {
    const choosing = transformReducer(transform, { type: 'source-tick' });
    const answered = transformReducer(choosing, { type: 'select-option', index: transform.correctOptionIndex, answerMs: 100 });
    const paused = transformReducer(answered, { type: 'pause' });
    return { paused, next: transformReducer(paused, { type: 'next-round' }) };
  } },
];

async function mount(fixture: Fixture) {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(fixture.id, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
  }));
  await render(<fixture.Screen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(fixture.id, 'start')));
  return { clock, completeSession };
}

async function reveal(fixture: Fixture, clock: ReturnType<typeof createFakeClock>) {
  if (fixture.revealMs < 0) {
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'choice-begin')));
  } else if (fixture.revealMs > 0) {
    await act(async () => {
      clock.advance(fixture.revealMs);
      jest.advanceTimersByTime(fixture.revealMs);
    });
  }
}

async function finish(fixture: Fixture, completeSession: Awaited<ReturnType<typeof mount>>['completeSession']) {
  await fireEvent.press(screen.getByTestId(testId(fixture.id, 'qa-toggle')));
  await fireEvent.press(screen.getByTestId(testId(fixture.id, fixture.finish)));
  await act(async () => {});
  const input = completeSession.mock.calls[0][0] as CompleteSessionInput;
  return input.session.rawResult as { score: number; totalResponseMs: number; averageAnswerMs: number; totalRemainingMs: number; totalAnswers: number; timeouts: number };
}

describe('spatial real-screen active timing and input epochs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPressCallbacks.clear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(pausedFeedbackTransitions)('$id rejects next-round while feedback is paused at the reducer boundary', ({ run }) => {
    const { paused, next } = run();
    expect(next).toBe(paused);
  });

  it.each(fixtures.filter((fixture) => fixture.id !== 'spatial-mental-rotation'))(
    '$id includes pre-pause thinking and fractional active time in the committed answer',
    async (fixture) => {
      const { clock, completeSession } = await mount(fixture);
      await reveal(fixture, clock);
      // No pacing callback is delivered during these active segments.
      clock.advance(1375);
      await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
      clock.advance(5000);
      await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
      clock.advance(625);
      await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
      const raw = await finish(fixture, completeSession);
      expect(fixture.id.endsWith('match') ? raw.averageAnswerMs : raw.totalResponseMs).toBe(2000);
    },
  );

  it('Mental Rotation commits the actual answer instant between clock polls', async () => {
    const fixture = fixtures[2];
    const { clock, completeSession } = await mount(fixture);
    clock.advance(1375);
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
    const raw = await finish(fixture, completeSession);
    expect(raw.totalRemainingMs).toBe(16000 - 1375);
  });

  it.each([16000, 16001])('Mental Rotation treats an answer at active %i ms as timeout before the next poll', async (atMs) => {
    const fixture = fixtures[2];
    const { clock, completeSession } = await mount(fixture);
    const audio = jest.spyOn(liveAudioHaptics, 'playSfx');
    clock.advance(atMs);
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
    expect(screen.getByTestId(`${fixture.id}.round-failed`)).toHaveTextContent('Time’s up');
    const raw = await finish(fixture, completeSession);
    expect(raw.totalAnswers).toBe(0);
    expect(raw.timeouts).toBe(1);
    expect(audio).not.toHaveBeenCalledWith('spatial-answer-correct');
  });

  it.each([15999, 15999.75])('Mental Rotation accepts an answer at active %s ms while the exact deadline is still ahead', async (atMs) => {
    const fixture = fixtures[2];
    const { clock, completeSession } = await mount(fixture);
    clock.advance(atMs);
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
    expect(screen.queryByTestId(`${fixture.id}.round-passed`)).not.toBeNull();
    const raw = await finish(fixture, completeSession);
    expect(raw.totalRemainingMs).toBe(16000 - atMs);
    expect(raw.totalAnswers).toBe(1);
    expect(raw.timeouts).toBe(0);
  });

  it.each([
    { fixture: fixtures[0], budgetMs: 12000, tickMs: 100 },
    { fixture: fixtures[3], budgetMs: 1300, tickMs: 100 },
  ])('$fixture.id ends study when an overdue callback is finally delivered', async ({ fixture, budgetMs, tickMs }) => {
    const { clock } = await mount(fixture);
    // Simulate a JS stall: wall/active time passes but only one timer runs.
    clock.advance(budgetMs + 500);
    await act(async () => jest.advanceTimersByTime(tickMs));
    expect(screen.getByTestId(`${fixture.id}.${fixture.pick}`)).toBeOnTheScreen();
  });

  it.each([
    { fixture: fixtures[0], budgetMs: 12000 },
    { fixture: fixtures[3], budgetMs: 1300 },
    { fixture: fixtures[4], budgetMs: 1500 },
  ])('$fixture.id expires study at the exact remaining active deadline after a fractional pause', async ({ fixture, budgetMs }) => {
    const { clock } = await mount(fixture);
    await act(async () => { clock.advance(50); jest.advanceTimersByTime(50); });
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(5000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    await act(async () => { clock.advance(budgetMs - 100); jest.advanceTimersByTime(budgetMs - 100); });
    expect(screen.queryByTestId(`${fixture.id}.${fixture.pick}`)).toBeNull();
    await act(async () => { clock.advance(50); jest.advanceTimersByTime(50); });
    expect(screen.queryByTestId(`${fixture.id}.${fixture.pick}`)).not.toBeNull();
  });

  it.each(fixtures)('$id ignores a captured answer callback from the previous round', async (fixture) => {
    const { clock } = await mount(fixture);
    await reveal(fixture, clock);
    const oldPress = mockPressCallbacks.get(`${fixture.id}.${fixture.pick}`)!;
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'next-round')));
    await reveal(fixture, clock);
    await act(async () => oldPress());
    expect(screen.queryByTestId(testId(fixture.id, fixture.resultPhase))).toBeNull();
  });

  it.each(fixtures)('$id invalidates a pre-pause callback while allowing the newly rendered resumed choice', async (fixture) => {
    const { clock } = await mount(fixture);
    await reveal(fixture, clock);
    const oldPress = mockPressCallbacks.get(`${fixture.id}.${fixture.pick}`)!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(3000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'spatial-fold-match' ? 'feedback' : 'playSfx');
    await act(async () => oldPress());
    expect(screen.queryByTestId(testId(fixture.id, fixture.resultPhase))).toBeNull();
    expect(audio).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.pick}`));
    expect(screen.queryByTestId(testId(fixture.id, fixture.resultPhase))).not.toBeNull();
    expect(audio).toHaveBeenCalledTimes(1);
  });

  it.each(fixtures)('$id rejects an answer callback after the lifecycle was abandoned', async (fixture) => {
    const { clock } = await mount(fixture);
    await reveal(fixture, clock);
    const oldPress = mockPressCallbacks.get(`${fixture.id}.${fixture.pick}`)!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'quit')));
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'spatial-fold-match' ? 'feedback' : 'playSfx');
    await act(async () => oldPress());
    expect(audio).not.toHaveBeenCalled();
    expect(screen.queryByTestId(testId(fixture.id, fixture.resultPhase))).toBeNull();
  });

  it.each(fixtures)('$id gives feedback once for two answer callbacks in the same React batch', async (fixture) => {
    const { clock } = await mount(fixture);
    await reveal(fixture, clock);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'spatial-fold-match' ? 'feedback' : 'playSfx');
    const press = mockPressCallbacks.get(`${fixture.id}.${fixture.pick}`)!;
    await act(async () => {
      press();
      press();
    });
    expect(audio).toHaveBeenCalledTimes(1);
  });
});
