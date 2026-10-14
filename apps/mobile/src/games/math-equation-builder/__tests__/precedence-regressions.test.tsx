import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createInMemoryTutorialStore, createFakeClock, testId } from '@/sdk';
import MathEquationBuilderScreen from '../screen';
import { evaluateEquation } from '../evaluator';
import * as generator from '../generator';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe('Equation Builder ordinary arithmetic', () => {
  it.each([
    { tokens: [10, '-', 2, '×', 3], value: 4 },
    { tokens: [24, '÷', 3, '+', 2, '×', 5], value: 18 },
    { tokens: [20, '-', 12, '÷', 3, '×', 2], value: 12 },
    { tokens: [24, '÷', 3, '÷', 2], value: 4 },
    { tokens: [9, '-', 3, '-', 2], value: 4 },
    { tokens: ['(', 2, '+', 3, ')', '×', 4], value: 20 },
    { tokens: [2, '+', '(', 3, '×', 4, ')'], value: 14 },
    { tokens: [2, '+', 3, '÷', 0], value: null },
    { tokens: [2, '+', 3, '÷', 2], value: null },
    { tokens: ['(', 2, '+', 3, ')', 4], value: null },
  ])('honors ordinary grouping/precedence and exact division for $tokens', ({ tokens, value }) => {
    expect(evaluateEquation(tokens as import('../types').EquationToken[])).toBe(value);
  });

  it('evaluates the displayed 2 + 3 × 4 expression to 14', () => {
    expect(evaluateEquation([2, '+', 3, '×', 4])).toBe(14);
  });

  it.each([14, 20])('scores the actual displayed expression against target %s', async (target) => {
    // Deterministic puzzle fixture; the actual screen pads and submit caller
    // construct the same unparenthesized expression the player sees.
    jest.spyOn(generator, 'generatePuzzle').mockReturnValue({ numbers: [2, 3, 4], target, operators: ['+', '×'] });
    await render(<MathEquationBuilderScreen clock={createFakeClock(0)} tutorialStore={completedStore()} sessionSeed="precedence" />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'operator', '+')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number', '1')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'operator', '×')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number', '2')));
    expect(screen.getByTestId(testId(GAME_ID, 'equation'))).toHaveTextContent('2 + 3 × 4 = ?');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    expect(screen.getByTestId(testId(GAME_ID, target === 14 ? 'round-passed' : 'round-failed'))).toBeTruthy();
    expect(screen.queryByTestId(testId(GAME_ID, target === 14 ? 'round-failed' : 'round-passed'))).toBeNull();
  });
});
