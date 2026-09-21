/**
 * ColorButton sizing contract (Change 065).
 *
 * The answer buttons were a fixed 100x60 box while their labels scale up to
 * 2x, so a long label could clip. They must use MINIMUM dimensions (the
 * button grows with the label); the palette grid keeps its wrapping layout.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { testId } from '@/sdk';

import { ColorButton, ColorButtonGrid } from '../components/color-button';
import { COLOR_PALETTE, GAME_ID } from '../types';

function flatStyle(style: unknown): Record<string, unknown> {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  const flat = StyleSheet.flatten(resolved as never);
  return (flat ?? {}) as Record<string, unknown>;
}

describe('ColorButton sizing', () => {
  it('uses minimum sizing so a font-scale-2 label can grow the button', async () => {
    await render(<ColorButton color="red" onPress={() => {}} />);

    const button = screen.getByTestId(testId(GAME_ID, 'color-btn', 'red'));
    const style = flatStyle(button.props.style);
    expect(style.minWidth).toBe(100);
    expect(style.minHeight).toBe(60);
    // No fixed box: a scaled label must be able to expand the button.
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
  });

  it('keeps the palette grid wrapping its rows', async () => {
    await render(<ColorButtonGrid colors={COLOR_PALETTE} onPress={() => {}} />);

    const grid = screen.getByTestId(testId(GAME_ID, 'color-grid'));
    const style = flatStyle(grid.props.style);
    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBe('wrap');
  });
});
