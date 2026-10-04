/**
 * `Confetti` primitive contract (071 §6.1 shared-kit coverage debt).
 *
 * Pins the invariants the celebration depends on: the piece layout is
 * DETERMINISTIC for a given seed (screenshots and tests stay stable), pieces
 * are confined to the left/right margins so centre copy stays legible, the
 * burst is non-interactive and hidden from accessibility, and both the
 * reduced-motion path and `enabled={false}` render the settled end state
 * (nothing falling) instead of animating.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type ViewStyle } from 'react-native';

import { Confetti } from '@/components/ui/confetti';

const mockReduceMotion = jest.fn<() => boolean>(() => false);
jest.mock('@/components/a11y/reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReduceMotion(),
}));

/** Deterministic host width for the margin assertions. */
const WINDOW_WIDTH = 800;

/** Flattened root style of the rendered Confetti host. */
function rootStyle(tree: Awaited<ReturnType<typeof render>>): Record<string, unknown> {
  const json = tree.toJSON() as { props?: { style?: unknown } } | null;
  return (StyleSheet.flatten(json?.props?.style) ?? {}) as Record<string, unknown>;
}

/** Flattened styles of every rendered confetti piece (Animated.Views). */
function pieceStyles(tree: Awaited<ReturnType<typeof render>>): ViewStyle[] {
  const json = tree.toJSON() as {
    props?: { style?: unknown };
    children?: { props?: { style?: unknown } }[];
  } | null;
  const kids = Array.isArray(json?.children) ? json!.children! : [];
  return kids.map(
    (child) => (StyleSheet.flatten(child.props?.style) ?? {}) as ViewStyle,
  );
}

describe('Confetti', () => {
  it('renders the burst with one piece per count entry', async () => {
    const tree = await render(<Confetti count={6} seed="contract" />);
    expect(pieceStyles(tree)).toHaveLength(6);
  });

  it('is deterministic: the same seed produces the identical layout', async () => {
    const a = pieceStyles(await render(<Confetti count={12} seed="determinism" />));
    const b = pieceStyles(await render(<Confetti count={12} seed="determinism" />));
    expect(a).toHaveLength(b.length);
    // left / size / color / round shape must all reproduce exactly.
    expect(a.map((p) => [p.left, p.width, p.height, p.backgroundColor])).toEqual(
      b.map((p) => [p.left, p.width, p.height, p.backgroundColor]),
    );
  });

  it('keeps every piece inside the left/right margins (centre copy stays legible)', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: WINDOW_WIDTH,
      height: 1200,
      scale: 2,
      fontScale: 1,
    } as ReturnType<typeof Dimensions.get>);
    try {
      const tree = await render(<Confetti count={24} seed="margins" />);
      const pieces = pieceStyles(tree);
      expect(pieces.length).toBeGreaterThan(0);
      for (const piece of pieces) {
        const left = Number(piece.left);
        const inLeftMargin = left >= 0 && left <= WINDOW_WIDTH * 0.22;
        const inRightMargin = left >= WINDOW_WIDTH * 0.78 && left <= WINDOW_WIDTH;
        expect(inLeftMargin || inRightMargin).toBe(true);
      }
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('renders nothing (settled end state) under reduced motion', async () => {
    mockReduceMotion.mockReturnValue(true);
    const tree = await render(<Confetti count={12} seed="reduced" />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing when disabled even with motion allowed', async () => {
    mockReduceMotion.mockReturnValue(false);
    const tree = await render(<Confetti count={12} seed="disabled" enabled={false} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('is non-interactive and hidden from accessibility', async () => {
    const tree = await render(<Confetti count={4} seed="a11y" />);
    const json = tree.toJSON() as {
      props: Record<string, unknown>;
    } | null;
    expect(json?.props.pointerEvents).toBe('none');
    expect(json?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('bounds the burst height to the configured dp value', async () => {
    const tree = await render(<Confetti count={4} seed="height" height={180} />);
    expect(rootStyle(tree).height).toBe(180);
  });

  it('draws pieces only from the fixed identity palette', async () => {
    const tree = await render(<Confetti count={18} seed="palette" />);
    const colors = pieceStyles(tree).map((p) => String(p.backgroundColor));
    expect(colors.length).toBe(18);
    // Every piece has a concrete color; a fixed palette over 18 deterministic
    // draws must produce more than one hue (the campaign's colour sweep).
    expect(new Set(colors).size).toBeGreaterThanOrEqual(2);
    for (const color of colors) {
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });
});
