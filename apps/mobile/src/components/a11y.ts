/**
 * Shared shell accessibility helpers (W12).
 *
 * Single source of truth for the shell-wide touch-target contract so screens
 * stop re-inventing one-off minimums. Games own their in-game controls via
 * `@/components/game-ui`; this module covers the product shell.
 */

/** Minimum interactive control height in dp/pt (WCAG 2.5.5 / HIG / Material). */
export const MIN_TOUCH_TARGET = 44;

/**
 * Style fragment that lifts a pill/text button to the minimum touch target
 * without changing its horizontal footprint. Merge it into the *visible*
 * control style (the Pressable's child) so the hit area matches what the user
 * sees, e.g. `style={[styles.chip, MinTouchTarget]}`.
 */
export const MinTouchTarget = {
  minHeight: MIN_TOUCH_TARGET,
  justifyContent: 'center',
} as const;
