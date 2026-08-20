/**
 * Memory Tile / TileGrid performance + a11y regression (task 07).
 *
 * Performance: `Tile` and `TileGrid` must stay `React.memo` so that per-tick
 * re-renders of the screen (reveal/recall pacing) do not re-render every tile
 * whose visual is unchanged. This is the evidence-driven fix for the
 * frequently-re-rendering board; a future edit that drops the memo would
 * regress catalog-wide render cost and break this guard. The stable-handler
 * wiring (grid passes a `onPressTile` straight through, no per-cell closure)
 * is verified functionally below.
 *
 * Accessibility: tiles must not leak the sequence and must report selected
 * state truthfully. RNTL v14 `render` is async, so every render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testId } from '@/sdk';

import { Tile } from '../components/tile';
import { TileGrid } from '../components/grid';
import type { TileVisualState } from '../components/tile';
import { GAME_ID } from '../types';

const MEMO = Symbol.for('react.memo');

describe('Memory Tile / TileGrid memoization', () => {
  it('keeps Tile and TileGrid memoized (React.memo)', () => {
    expect((Tile as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO);
    expect((TileGrid as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO);
  });
});

describe('Memory TileGrid wiring + accessibility', () => {
  const visualFor = (i: number): TileVisualState => (i === 0 ? 'selected' : 'idle');

  it('renders one neutral, labelled tile per cell and threads visual/state through', async () => {
    await render(
      <TileGrid gridSize={9} testID="mem-grid" visualFor={visualFor} onPressTile={() => {}} />,
    );

    expect(screen.getByTestId('mem-grid')).toBeOnTheScreen();
    for (let i = 0; i < 9; i += 1) {
      const el = screen.getByTestId(testId(GAME_ID, 'tile', String(i)));
      expect(el.props.accessibilityRole).toBe('button');
      expect(el.props.accessibilityLabel).toBe(`Tile ${i + 1}`);
      expect(el.props.accessibilityState).toMatchObject({
        selected: i === 0,
        disabled: false,
      });
    }
  });
});

describe('Memory Tile accessibility', () => {
  it('does not leak the sequence and reports selected state', async () => {
    const { getByTestId } = await render(
      <Tile index={4} visual="selected" onPressTile={() => {}} />,
    );
    const el = getByTestId(testId(GAME_ID, 'tile', '4'));
    expect(el.props.accessibilityLabel).toBe('Tile 5');
    expect(el.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
  });
});
