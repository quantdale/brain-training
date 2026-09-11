/**
 * Shared accessibility primitives (W12 shell contract + W14 a11y program).
 *
 * Barrel over the leaf modules in `components/a11y/`. Import from
 * `@/components/a11y` in screens; shared `game-ui` primitives must import the
 * leaf paths directly (e.g. `@/components/a11y/touch-target`) because this
 * barrel re-exports dialog/stats modules that would otherwise create an
 * import cycle back through game-ui.
 *
 * Contents:
 * - touch-target: the 44pt minimum control contract (shell-wide).
 * - font-scale: dynamic-type cap (~1.35) + board-glyph opt-out constants.
 * - reduced-motion: shared preference hook + pure motion selectors.
 * - focus: screen-reader cursor helpers (sendAccessibilityEvent focus with retries).
 * - announcements: imperative announce + polite/assertive live regions.
 * - result-feedback: game-result announcement pattern.
 * - dialog: accessible modal dialog primitive (`A11yDialog`).
 */

export { MIN_TOUCH_TARGET, MinTouchTarget } from './a11y/touch-target';

export {
  MAX_FONT_SCALE,
  BOARD_GLYPH_FONT_SCALE,
  effectiveFontScale,
} from './a11y/font-scale';

export {
  usePrefersReducedMotion,
  motionValue,
  reduceDuration,
} from './a11y/reduced-motion';

export { requestAccessibilityFocus, useInitialA11yFocus } from './a11y/focus';

export { announce, LiveRegion } from './a11y/announcements';
export type { LiveRegionProps } from './a11y/announcements';

export { A11yDialog } from './a11y/dialog';
export type { A11yDialogProps } from './a11y/dialog';
