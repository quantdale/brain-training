import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { createRng, testId } from '@/sdk';

import { OptionButton } from '../components/option-button';
import { Tutorial, TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateSourcePattern } from '../generator';
import { GAME_ID } from '../types';

describe('Transform Match candidate presentation', () => {
  it.each([9, 16])('bounds the real %i-cell candidate and preserves visible miniature cells', async (gridSize) => {
    await render(<OptionButton index={0} gridSize={gridSize} pattern={[0, 1, 3]}
      selected={false} correct={false} onPressOption={() => {}} />);
    const option = screen.getByTestId(testId(GAME_ID, 'option', '0'));
    const style = StyleSheet.flatten(option.props.style);
    expect(style.width).toBeGreaterThanOrEqual(48);
    expect(style.width).toBeLessThanOrEqual(112);
    const tile = screen.getByTestId(testId(GAME_ID, 'cell', '0'), { includeHiddenElements: true });
    const cell = StyleSheet.flatten(tile.parent?.props.style);
    const tileWidth = (style.width - 2 * style.borderWidth - 2 * style.padding) /
      Math.sqrt(gridSize) - 2 * cell.padding;
    expect(tileWidth).toBeGreaterThanOrEqual(14);
  });

  it('shows the two actual demo candidates without a correctness label', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const source = generateSourcePattern(createRng(TUTORIAL_DEMO_SEED), 0, 9, 3);
    // Independent 3x3 clockwise-coordinate mapping, not the transform helper.
    const rotated = source.map((cell) => (cell % 3) * 3 + 2 - Math.floor(cell / 3));
    for (let index = 0; index < 2; index += 1) {
      // Candidate cells deliberately stay out of TalkBack: their outer
      // button owns the descriptive label. Inspect their rendered geometry.
      const candidate = screen.getByTestId(testId(GAME_ID, 'option-grid', String(index)), { includeHiddenElements: true });
      const button = screen.getByTestId(testId(GAME_ID, 'tutorial-option', String(index)));
      expect(button.props.accessibilityLabel).not.toMatch(/correct|wrong/i);
      expect(within(candidate).getAllByTestId(/^spatial-transform-match\.cell\./, { includeHiddenElements: true })).toHaveLength(9);
    }
    const first = screen.getByTestId(testId(GAME_ID, 'option-grid', '0'), { includeHiddenElements: true });
    const label = first.props.accessibilityLabel as string;
    for (const cell of rotated) {
      expect(label).toContain(`row ${Math.floor(cell / 3) + 1} column ${cell % 3 + 1}`);
    }
    expect(label).not.toBe(screen.getByTestId(testId(GAME_ID, 'option-grid', '1'), { includeHiddenElements: true }).props.accessibilityLabel);
  });

  it('bounds the demo source and gives long steps an explicit scroll viewport', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    const scroll = screen.getByTestId(testId(GAME_ID, 'tutorial-scroll'));
    expect(StyleSheet.flatten(scroll.props.style).height).toBeGreaterThan(0);
    expect(StyleSheet.flatten(scroll.props.style).height).toBeLessThanOrEqual(600);
    const source = screen.getByTestId(testId(GAME_ID, 'tutorial-source'));
    expect(StyleSheet.flatten(source.parent?.props.style).maxWidth).toBeLessThanOrEqual(200);
  });

  it('still completes through a normal answer and Done', async () => {
    const complete = jest.fn();
    await render(<Tutorial onComplete={complete} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-option', '0')));
    expect(complete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
