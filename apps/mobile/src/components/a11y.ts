/**
 * Shared accessibility primitives (W12 shell contract + W14 a11y program).
 *
 * Barrel over the leaf modules in `components/a11y/`. Import from
 * `@/components/a11y` in screens; shared `game-ui` primitives must import the
 * leaf paths directly (e.g. `@/components/a11y/touch-target`) because this
 * barrel re-exports game-ui-facing modules that would otherwise create an
 * import cycle back through game-ui.
 *
 * Contents:
 * - touch-target: the 44 dp minimum control contract (shell-wide). This is the
 *   ONE canonical definition of the minimum; the former theme export and the
 *   platform literal were removed in Change 071.
 * - font-scale: the dynamic-type cap (`MAX_FONT_SCALE`, the real value — see
 *   `a11y/font-scale.ts`) plus the board-glyph opt-out constant.
 * - reduced-motion: shared preference hook + pure motion selectors.
 * - focus: screen-reader cursor helpers (sendAccessibilityEvent focus with
 *   retries).
 * - announcements: the imperative `announce()` pass-through.
 *
 * Change 071: this list previously named a `result-feedback` module that does
 * not exist, and an `A11yDialog` primitive that was removed as unreachable.
 * A contents list that drifts is worse than no list, because it tells a reader
 * which imports are available.
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

export { announce } from './a11y/announcements';

