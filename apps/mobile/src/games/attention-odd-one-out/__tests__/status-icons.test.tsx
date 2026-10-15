import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { ItemTile } from '../components/tile';
import type { DeviationSpec } from '../types';

const DEVIATION: DeviationSpec = {
  kind: 'shape', key: 'shape-circle-square', glyph: '●', color: null,
  rotation: 0, oddGlyph: '■', oddColor: null, oddRotation: 0,
};

describe('Odd One Out vector outcome markers', () => {
  it.each([
    ['error', 'M18 6 6 18', 'Item 1, incorrect'],
    ['found', 'M20 6 9 17l-5-5', 'Item 1, the odd one out'],
  ] as const)('retains the stimulus and spoken %s outcome', async (...args) => {
    const [visual, path, label] = args;
    await render(<ItemTile index={0} deviation={DEVIATION} isOdd visual={visual} glyphSize={28} />);
    const tile = screen.getByLabelText(label);
    const vectors = tile.queryAll((node) => node.type.startsWith('RNSVGSvgView'));
    expect(vectors).toHaveLength(1);
    expect(vectors[0].queryAll((node) => node.type === 'RNSVGPath' && node.props.d === path)).toHaveLength(1);
    expect(vectors[0].props.accessible).toBe(false);
    expect(screen.getByText('■')).toBeOnTheScreen();
    expect(screen.queryAllByText(/[✓✕]/, { includeHiddenElements: true })).toHaveLength(0);
  });

  it('keeps live puzzle glyphs free of outcome markers and answer labels', async () => {
    await render(<ItemTile index={0} deviation={DEVIATION} isOdd visual="idle" glyphSize={28} />);
    const tile = screen.getByLabelText('Item 1');
    expect(tile.queryAll((node) => node.type.startsWith('RNSVGSvgView'))).toHaveLength(0);
    expect(screen.getByText('■')).toBeOnTheScreen();
  });
});
