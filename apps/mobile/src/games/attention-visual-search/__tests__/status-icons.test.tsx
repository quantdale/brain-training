import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { Tile } from '../components/tile';

describe('Visual Search vector outcome markers', () => {
  it.each([
    ['selected', 'M20 6 9 17l-5-5'], ['error', 'M18 6 6 18'],
  ] as const)('keeps the visible feature and %s semantics', async (...args) => {
    const [visual, path] = args;
    await render(<Tile index={0} visual={visual} />);
    const tile = screen.getByTestId('attention-visual-search.tile.0');
    const vectors = tile.queryAll((node) => node.type.startsWith('RNSVGSvgView'));
    expect(vectors).toHaveLength(1);
    expect(vectors[0].queryAll((node) => node.type === 'RNSVGPath' && node.props.d === path)).toHaveLength(1);
    expect(vectors[0].props.accessible).toBe(false);
    expect(tile.props.accessibilityLabel).toMatch(visual === 'error' ? /red square, incorrect/ : /orange square/);
    expect(tile.props.accessibilityState.selected).toBe(visual === 'selected');
    expect(screen.queryAllByText(/[✓✕]/, { includeHiddenElements: true })).toHaveLength(0);
  });

  it('does not add an answer marker or classification to a live target', async () => {
    await render(<Tile index={0} visual="target" />);
    const tile = screen.getByLabelText('Tile 1, orange square');
    expect(tile.queryAll((node) => node.type.startsWith('RNSVGSvgView'))).toHaveLength(0);
    expect(tile.props.accessibilityState.selected).toBe(false);
  });
});
