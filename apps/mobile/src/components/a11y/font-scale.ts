/**
 * Dynamic-type contract (campaign 024 revision of the xplat audit B1 policy).
 *
 * Campaign 010 applied one blanket ~1.35 cap to every `ThemedText` so large
 * system font settings could not break board/row layouts. That solved the
 * symptom by shrinking *all* copy, including body text a low-vision user
 * explicitly asked to enlarge — the audit for this campaign flagged it as
 * "masking layout fragility instead of fixing it".
 *
 * The campaign-024 policy is per-role:
 *   - body copy scales up to 2.0 (the accessibility intent is honoured),
 *   - section/hero styles keep a tighter cap so a 36 dp display line cannot
 *     exceed a phone's width,
 *   - board glyphs still opt out entirely (spatial content, not copy).
 *
 * Layouts are expected to wrap and grow; where a fixed size is genuinely
 * required (board cells, fixed-size chrome), callers pass an explicit
 * `maxFontSizeMultiplier` or `allowFontScaling={false}` — same seam as before,
 * now used deliberately instead of everywhere.
 */

import type { TypographyName } from '@/theme/tokens';

/** Upper bound for body copy and other reading text. */
export const MAX_FONT_SCALE = 2;

/** Explicit "never scale" value for board glyphs. */
export const BOARD_GLYPH_FONT_SCALE = 1;

/** Cap applied to section headings and screen titles. */
export const HEADING_FONT_SCALE = 1.6;

/** Cap applied to hero display text and hero numerals. */
export const DISPLAY_FONT_SCALE = 1.4;

/**
 * Per-role caps, keyed by typography token. Every token must appear here so a
 * new style cannot silently inherit an unbounded (or accidentally tiny) cap.
 */
export const FONT_SCALE_CAP: Record<TypographyName, number> = {
  eyebrow: MAX_FONT_SCALE,
  caption: MAX_FONT_SCALE,
  label: MAX_FONT_SCALE,
  bodySmall: MAX_FONT_SCALE,
  body: MAX_FONT_SCALE,
  bodyLarge: MAX_FONT_SCALE,
  headline: HEADING_FONT_SCALE,
  title: HEADING_FONT_SCALE,
  display: DISPLAY_FONT_SCALE,
  numeral: HEADING_FONT_SCALE,
  numeralLg: DISPLAY_FONT_SCALE,
  numeralXl: DISPLAY_FONT_SCALE,
};

/**
 * Effective scale for a given OS setting: clamped to `[1, max]`. The lower
 * clamp is the "scale-aware minimum" half of the contract — smaller-than-normal
 * system settings must not shrink body copy below its designed size.
 */
export function effectiveFontScale(systemScale: number, max: number = MAX_FONT_SCALE): number {
  return Math.min(Math.max(systemScale, 1), max);
}
