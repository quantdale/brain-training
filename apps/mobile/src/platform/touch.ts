/**
 * Touch interaction adapters — shared guarantees for pointer ergonomics.
 *
 * The shell a11y contract requires >=44pt interactive targets
 * (`components/__tests__/shell-a11y.test.tsx`). These helpers let visually
 * small controls honor that contract via `hitSlop` expansion instead of
 * inflating the visible chrome or failing the contract.
 */

import type { Insets } from 'react-native';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

/**
 * Minimum comfortable touch-target edge in dp (iOS HIG and Material both cite
 * 44–48).
 *
 * 071: this used to be a third literal `44`, independent of both the
 * accessibility constant and the theme export. Three copies of one
 * accessibility number is precisely the drift the audit flagged — nothing
 * connected them, so lowering or raising one would silently leave the others
 * asserting a different target. It now DERIVES from the canonical constant, so
 * it cannot disagree with the rest of the app by construction.
 */
export const MIN_TOUCH_TARGET_SIZE: number = MIN_TOUCH_TARGET;

/**
 * Hit slop that expands a control's tappable area to `MIN_TOUCH_TARGET_SIZE`
 * without changing its laid-out size. Returns `null` when the control already
 * meets the minimum, so callers can skip spreading an empty object:
 *
 *   <Pressable hitSlop={hitSlopToTouchTarget(32) ?? undefined} … />
 */
export function hitSlopToTouchTarget(renderedSize: number): Insets | null {
  const deficit = MIN_TOUCH_TARGET_SIZE - renderedSize;
  if (deficit <= 0) {
    return null;
  }
  // Round up so a fractional layout size still reaches the full minimum.
  const slop = Math.ceil(deficit / 2);
  return { top: slop, bottom: slop, left: slop, right: slop };
}
