/**
 * Button edge-tap contract (076-f defect repair).
 *
 * Defect reproduced on device: a tap landing exactly on a button's outer bound
 * edge did not register, while a tap at its centre always did. Two causes
 * stacked — `hitSlopToTouchTarget()` returns `null` once a control already
 * meets the 48dp floor, so `Tappable` applied no expansion at all, and React
 * Native's hit test is boundary-exclusive, so the outermost pixel row and
 * column of a perfectly compliant button were dead.
 *
 * This pins the fix: every Button must apply an edge allowance beyond its
 * painted bounds. The value is asserted too, not just its presence — a larger
 * allowance would let adjacent controls steal each other's edge taps (the kit
 * leaves 8dp between siblings, so 4dp per side is exactly the safe maximum).
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui';

describe('Button edge-tap target', () => {
  it('expands the hit area past the painted bounds so edge taps register', async () => {
    await render(<Button label="Next trial" testID="next-trial" onPress={() => {}} />);
    const hit = screen.getByTestId('next-trial');
    // `hitSlop` may be resolved internally by Tappable; accept either the raw
    // prop or the resolved insets, but it must be NON-EMPTY. A null/absent
    // slop is precisely the regression that made the edge dead.
    const slop = hit.props.hitSlop ?? hit.props.accessibilityHitSlop;
    expect(slop).toBeTruthy();
  });

  it('keeps the allowance at 4dp per side so it cannot steal a neighbour tap', async () => {
    await render(<Button label="Next trial" testID="next-trial" onPress={() => {}} />);
    const hit = screen.getByTestId('next-trial');
    const slop = hit.props.hitSlop;
    // Sibling kit controls sit `Spacing.two` (8dp) apart. 4dp per side makes
    // two neighbours' hit areas meet at the gap midpoint and never overlap;
    // anything larger lets one control capture the other's edge taps.
    const perSide =
      typeof slop === 'number'
        ? slop
        : Math.max(slop?.top ?? 0, slop?.bottom ?? 0, slop?.left ?? 0, slop?.right ?? 0);
    expect(perSide).toBeGreaterThan(0);
    expect(perSide).toBeLessThanOrEqual(4);
  });
});
