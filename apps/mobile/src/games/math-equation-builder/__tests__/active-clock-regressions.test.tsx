import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';
import MathEquationBuilderScreen from '../screen';
import * as generator from '../generator';
import { GAME_ID } from '../types';
import { MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS } from '../difficulty';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
const mockNumberPressCallbacks: ((index: number) => void)[] = [];
jest.mock('../components/number-pad', () => {
  const actual = jest.requireActual('../components/number-pad') as typeof import('../components/number-pad');
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    NumberPad: (props: import('../components/number-pad').NumberPadProps) => {
      mockNumberPressCallbacks.push(props.onNumberPress);
      return React.createElement(actual.NumberPad, props);
    },
  };
});
const budget = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal.timeBudgetMs;

beforeEach(() => {
  mockNumberPressCallbacks.length = 0;
  jest.useFakeTimers();
  jest.spyOn(generator, 'generatePuzzle').mockReturnValue({ numbers: [2, 3, 4, 5], target: 14, operators: ['+'] });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

async function start() {
  const clock = createFakeClock(0);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  await render(<MathEquationBuilderScreen clock={clock} tutorialStore={store} sessionSeed="active-clock" />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return clock;
}

async function enterSolution() {
  for (let index = 0; index < 4; index += 1) {
    if (index > 0) await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'operator', '+')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number', String(index))));
  }
}

describe('Equation Builder active monotonic budget', () => {
  it('uses subsecond active time in the solve bonus', async () => {
    const clock = await start();
    await enterSolution();
    clock.advance(450);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 299');
  });

  it('charges every active fraction across repeated subsecond pauses', async () => {
    const clock = await start();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await act(async () => { clock.advance(900); jest.advanceTimersByTime(900); });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
      await act(async () => { clock.advance(5_000); jest.advanceTimersByTime(5_000); });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'timer'))).toHaveTextContent('48s');
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
  });

  it('expires after a JS stall when only one interval callback is delivered', async () => {
    const clock = await start();
    await act(async () => { clock.advance(budget + 1); jest.advanceTimersByTime(1_000); });
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toHaveTextContent("Time's up!");
    expect(screen.getByTestId(testId(GAME_ID, 'timer'))).toHaveTextContent('0s');
  });

  it.each([0, 1])('rejects a correct submit %sms past the deadline without success feedback', async (pastDeadline) => {
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    const clock = await start();
    await enterSolution();
    feedback.mockClear();
    clock.advance(budget + pastDeadline);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toHaveTextContent("Time's up!");
    expect(feedback).not.toHaveBeenCalledWith('correct');
  });

  it('ignores a prior round pad callback without mutating the new puzzle or playing tap feedback', async () => {
    const feedback = jest.spyOn(liveAudioHaptics, 'feedback');
    await start();
    const staleNumberPress = mockNumberPressCallbacks[mockNumberPressCallbacks.length - 1];
    await enterSolution();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    feedback.mockClear();
    await act(async () => { staleNumberPress(0); });
    expect(screen.getByTestId(testId(GAME_ID, 'equation'))).toHaveTextContent('? = ?');
    expect(feedback).not.toHaveBeenCalledWith('tap');
  });
});
