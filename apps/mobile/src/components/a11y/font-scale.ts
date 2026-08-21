/**
 * Dynamic-type contract (xplat audit B1).
 *
 * Before campaign 010 nothing capped `maxFontSizeMultiplier`, so users with
 * large system font scales got unbounded text that broke board layouts.
 * The shared cap is deliberately modest (~1.35): large enough to honor the
 * accessibility intent, small enough that fixed grids/rows keep their shape.
 *
 * Board-glyph opt-out: in-board glyphs (symbols, arrows, letters rendered as
 * board cells) must NOT scale — they are spatial content, not copy. Render
 * them with `allowFontScaling={false}` (the convention the game modules
 * already use) or pass an explicit `maxFontSizeMultiplier` to override the
 * default cap applied by `ThemedText`.
 */

/** Default upper bound ThemedText applies to OS font scaling. */
export const MAX_FONT_SCALE = 1.35;

/**
 * Explicit "never scale" value for board glyphs. Kept as a named constant so
 * call sites read as a decision, not a magic `1`.
 */
export const BOARD_GLYPH_FONT_SCALE = 1;

/**
 * Effective scale for a given OS setting: clamped to `[1, max]`. The lower
 * clamp is the "scale-aware minimum" half of the contract — smaller-than-
 * normal system settings must not shrink body copy below its designed size.
 */
export function effectiveFontScale(systemScale: number, max: number = MAX_FONT_SCALE): number {
  return Math.min(Math.max(systemScale, 1), max);
}
