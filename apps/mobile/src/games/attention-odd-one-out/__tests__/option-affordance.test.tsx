/**
 * Option-affordance regression: every board tile is a tappable answer option,
 * so the idle outline must use the interactive-boundary token
 * (`borderStrong`, ≥3:1 vs surface) at the answer-option weight rather than
 * the decorative hairline border, which left selectable elements ambiguous.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Colors } from '@/constants/theme';
import { ItemTile } from '../components/tile';
import { GAME_ID } from '../types';
import type { DeviationSpec } from '../types';

const DEVIATION: DeviationSpec = {
  kind: 'shape', key: 'shape-circle-square', glyph: '●', color: null,
  rotation: 0, oddGlyph: '■', oddColor: null, oddRotation: 0,
};

describe('Odd One Out option affordance', () => {
  it('outlines idle tiles with the interactive-boundary token at option weight', async () => {
    await render(<ItemTile index={0} deviation={DEVIATION} isOdd={false} visual="idle" glyphSize={28} />);
    const tile = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'tile', '0')).props.style);
    expect(tile.borderWidth).toBe(2);
    expect([Colors.light.borderStrong, Colors.dark.borderStrong]).toContain(tile.borderColor);
    expect([Colors.light.border, Colors.dark.border]).not.toContain(tile.borderColor);
  });

  it.each([
    ['error', 'danger'],
    ['found', 'success'],
  ] as const)('keeps the stronger %s verdict outline distinct from the option outline', async (...args) => {
    const [visual, family] = args;
    await render(<ItemTile index={0} deviation={DEVIATION} isOdd visual={visual} glyphSize={28} />);
    const tile = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'tile', '0')).props.style);
    expect(tile.borderWidth).toBe(3);
    expect([Colors.light[family], Colors.dark[family]]).toContain(tile.borderColor);
  });
});
