/**
 * Minimum touch-target contract (single source of truth).
 *
 * Lives in its own leaf module (not the `@/components/a11y` barrel) so
 * `game-ui` primitives can adopt it without pulling the heavier barrel into
 * an import cycle (the barrel re-exports dialog/stats modules that compose
 * game-ui-style controls).
 *
 * Consumers: shell screens import from `@/components/a11y`; shared game-ui
 * primitives import from this leaf path.
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
