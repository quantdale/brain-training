import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as ReactNative from 'react-native';

import { createRng, testId } from '@/sdk';
import { Grid } from '../components/grid';
import { Tutorial, TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateSquare } from '../generator';
import { GAME_ID } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';

afterEach(() => { jest.restoreAllMocks(); });

describe('Rule Grid presented puzzle invariants', () => {
  it.each([264, 312, 560])('fits or scrolls an Expert board at %sdp without reducing cell legibility', async (width) => {
    await render(<Grid
      size={6}
      square={generateSquare(6, createRng('responsive-expert'))}
      blankIndex={0}
      renderSymbol={(value) => String(value + 1)}
      testIdCell={(index) => testId(GAME_ID, 'cell', String(index))}
    />);
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'grid-viewport')), 'layout', {
      nativeEvent: { layout: { width, height: 400, x: 0, y: 0 } },
    });
    const cell = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'cell', '0')).props.style);
    expect(cell.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(cell.height).toBe(cell.width);
    const board = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'grid')).props.style);
    expect(board.width).toBeCloseTo(6 * cell.width + 5 * board.gap);
    expect(screen.getByTestId(testId(GAME_ID, 'grid-scroll')).props.scrollEnabled).toBe(board.width > width);
    expect(screen.getAllByTestId(new RegExp(`^${GAME_ID}\\.grid-row\\.`))).toHaveLength(6);
  });

  it('grows cells with 2x text while retaining all row and column positions', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 640, scale: 1, fontScale: 2 });
    await render(<Grid
      size={6}
      square={generateSquare(6, createRng('large-text-expert'))}
      blankIndex={0}
      renderSymbol={(value) => String(value + 1)}
      testIdCell={(index) => testId(GAME_ID, 'cell', String(index))}
    />);
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'grid-viewport')), 'layout', {
      nativeEvent: { layout: { width: 264, height: 400, x: 0, y: 0 } },
    });
    const cell = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'cell', '0')).props.style);
    expect(cell.height).toBeGreaterThanOrEqual(64);
    expect(screen.getByTestId(testId(GAME_ID, 'grid-scroll')).props.scrollEnabled).toBe(true);
    expect(screen.getAllByTestId(new RegExp(`^${GAME_ID}\\.cell\\.`))).toHaveLength(36);
    expect(screen.getAllByTestId(new RegExp(`^${GAME_ID}\\.grid-row\\.`))).toHaveLength(6);
  });

  it.each([3, 4, 5, 6])('keeps a size %s board in explicit ordered rows', async (size) => {
    await render(<Grid
      size={size}
      square={generateSquare(size, createRng(`rows-${size}`))}
      blankIndex={0}
      renderSymbol={(value) => String(value + 1)}
      testIdCell={(index) => testId(GAME_ID, 'cell', String(index))}
    />);
    for (let row = 0; row < size; row += 1) {
      const rowView = screen.getByTestId(testId(GAME_ID, 'grid-row', String(row)));
      expect(within(rowView).getAllByTestId(new RegExp(`^${GAME_ID}\\.cell\\.`))).toHaveLength(size);
      for (let column = 0; column < size; column += 1) {
        expect(within(rowView).getByTestId(testId(GAME_ID, 'cell', String(row * size + column)))).toBeTruthy();
      }
      expect(StyleSheet.flatten(rowView.props.style).flexWrap).not.toBe('wrap');
    }
  });

  it('distinguishes the asked cell from every other hidden cell without color', async () => {
    await render(<Grid
      size={4}
      square={generateSquare(4, createRng('asked-cell'))}
      blankIndex={6}
      blanks={[1, 6, 14]}
      renderSymbol={(value) => String(value + 1)}
      testIdCell={(index) => testId(GAME_ID, 'cell', String(index))}
    />);
    const asked = screen.getByTestId(testId(GAME_ID, 'cell', '6'));
    const other = screen.getByTestId(testId(GAME_ID, 'cell', '1'));
    expect(asked).toHaveTextContent('?');
    expect(other).not.toHaveTextContent('?');
    expect(asked.props.accessibilityLabel).toMatch(/Row 2, column 3.*Asked cell/i);
    expect(other.props.accessibilityLabel).toMatch(/Hidden cell/i);
    expect(StyleSheet.flatten(asked.props.style).borderWidth)
      .toBeGreaterThan(StyleSheet.flatten(other.props.style).borderWidth);
  });

  it('explains the exact tutorial row, column and displayed answer', async () => {
    const square = generateSquare(3, createRng(TUTORIAL_DEMO_SEED));
    const rowValues = square[1].filter((_, column) => column !== 1).map((value) => value + 1);
    const columnValues = square.filter((_, row) => row !== 1).map((row) => row[1] + 1);
    const answer = square[1][1] + 1;
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    expect(screen.getByText(new RegExp(`row already has ${rowValues.join(' and ')}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`column already has ${columnValues.join(' and ')}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`missing symbol is ${answer}`))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-cell', '4'))).toHaveTextContent(String(answer));
    expect(screen.getAllByTestId(new RegExp(`^${GAME_ID}\\.grid-row\\.`))).toHaveLength(3);
  });
});
