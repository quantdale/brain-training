/**
 * WordChips touch-target floor (campaign 065, task 8).
 *
 * The sentence-builder chips are the densest session controls in the catalog;
 * they rendered at 36 dp with no hit-slop, below the shared 44 dp contract.
 * This pins the floor at the component seam so the catalog-wide session scan
 * (`catalog-persistence-matrix`) is not the only tripwire.
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WordChips } from '../components/word-grid';

function effectiveVerticalTarget(style: unknown): number {
  const flat = StyleSheet.flatten(style as never) as { minHeight?: number; height?: number } | null;
  return flat?.minHeight ?? flat?.height ?? 0;
}

describe('WordChips touch targets', () => {
  it('keeps every word chip at the 44 dp vertical floor', async () => {
    await render(
      <WordChips
        words={['alpha', 'beta']}
        tappedIndices={[]}
        testID="contract.word-grid"
        onTapWord={() => {}}
      />,
    );

    for (const [index, word] of ['alpha', 'beta'].entries()) {
      const chip = screen.getByTestId(`contract.word-grid.word.${index}`);
      expect(chip.props.accessibilityLabel).toBe(word);
      expect(chip.props.accessibilityRole).toBe('button');
      expect(effectiveVerticalTarget(chip.props.style)).toBeGreaterThanOrEqual(44);
    }
  });
});
