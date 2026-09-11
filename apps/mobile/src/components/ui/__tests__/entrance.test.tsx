/**
 * Entrance-stagger contract.
 *
 * The campaign requires screens to arrive as a sequence without ever delaying
 * interaction, and to render in their final state when reduced motion is on.
 * These assertions pin both halves: the animated presentation exists by
 * default, and the reduced-motion path is synchronous (opacity 1 on first
 * render, no pending animation for the block to sit behind).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Entrance } from '@/components/ui/entrance';

const mockReduceMotion = jest.fn<() => boolean>(() => false);
jest.mock('@/components/a11y/reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReduceMotion(),
}));

/** Flattened style of the rendered block. */
function flattenedStyle(testID: string): Record<string, unknown> {
  const style = screen.getByTestId(testID).props.style;
  return Object.assign({}, ...(Array.isArray(style) ? style.flat().filter(Boolean) : [style]));
}

describe('Entrance', () => {
  it('starts its content below full opacity so the block can rise in', async () => {
    mockReduceMotion.mockReturnValue(false);
    await render(
      <Entrance index={0} testID="block">
        <Text>Hero</Text>
      </Entrance>,
    );
    expect(flattenedStyle('block').opacity).toBe(0);
  });

  it('renders in its final state immediately under reduced motion', async () => {
    mockReduceMotion.mockReturnValue(true);
    await render(
      <Entrance index={2} testID="block">
        <Text>Hero</Text>
      </Entrance>,
    );
    const style = flattenedStyle('block');
    expect(style.opacity).toBe(1);
    // No translate offset to animate away from.
    expect(JSON.stringify(style.transform)).toContain('"translateY":0');
  });

  it('keeps content mounted and interactive from the first frame', async () => {
    mockReduceMotion.mockReturnValue(false);
    await render(
      <Entrance index={1} testID="block">
        <Text testID="child">Visible</Text>
      </Entrance>,
    );
    // The transition is presentational only: the child is in the tree while the
    // block is still transparent, so a fast tap is never swallowed.
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
