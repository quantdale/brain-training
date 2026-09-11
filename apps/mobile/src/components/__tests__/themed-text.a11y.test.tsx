/**
 * ThemedText dynamic-type contract (campaign 024 revision).
 *
 * Campaign 010 applied one blanket ~1.35 cap to every ThemedText. Campaign 024
 * replaced that with per-role caps so reading copy can reach 2× while hero
 * display styles stay inside a phone's width (spec `accessibility-upgrade` R5).
 * These assertions pin the prop-level contract that snapshot diffs only imply:
 * - reading styles carry the body cap,
 * - heading/hero styles carry their tighter caps,
 * - explicit per-node overrides still win (board glyphs pass 1),
 * - the `allowFontScaling={false}` glyph opt-out passes through untouched.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import {
  BOARD_GLYPH_FONT_SCALE,
  DISPLAY_FONT_SCALE,
  FONT_SCALE_CAP,
  HEADING_FONT_SCALE,
  MAX_FONT_SCALE,
} from '@/components/a11y/font-scale';
import { ThemedText } from '@/components/themed-text';

describe('ThemedText dynamic type', () => {
  it('lets reading copy scale to the body cap', async () => {
    await render(<ThemedText testID="t">Body copy</ThemedText>);
    expect(screen.getByTestId('t').props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    expect(MAX_FONT_SCALE).toBe(2);
  });

  it('keeps hero and heading styles inside their own caps', async () => {
    await render(
      <>
        <ThemedText testID="title" type="title">
          Progress
        </ThemedText>
        <ThemedText testID="hero" type="numeralXl">
          82%
        </ThemedText>
      </>,
    );
    expect(screen.getByTestId('title').props.maxFontSizeMultiplier).toBe(HEADING_FONT_SCALE);
    expect(screen.getByTestId('hero').props.maxFontSizeMultiplier).toBe(DISPLAY_FONT_SCALE);
    expect(HEADING_FONT_SCALE).toBeLessThan(MAX_FONT_SCALE);
    expect(DISPLAY_FONT_SCALE).toBeLessThanOrEqual(HEADING_FONT_SCALE);
  });

  it('caps every typography token explicitly', () => {
    // A new style must declare its cap instead of inheriting a default by luck.
    for (const [token, cap] of Object.entries(FONT_SCALE_CAP)) {
      expect(`${token}:${cap > 0 && cap <= MAX_FONT_SCALE}`).toBe(`${token}:true`);
    }
    expect(Object.keys(FONT_SCALE_CAP).length).toBeGreaterThanOrEqual(12);
  });

  it('renders tabular figures for numeral styles', async () => {
    await render(
      <ThemedText testID="n" type="numeral">
        1,240
      </ThemedText>,
    );
    const style = screen.getByTestId('n').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flattened.fontVariant).toEqual(['tabular-nums']);
  });

  it('lets an explicit maxFontSizeMultiplier override the default', async () => {
    await render(
      <ThemedText testID="glyph" maxFontSizeMultiplier={BOARD_GLYPH_FONT_SCALE}>
        ♟
      </ThemedText>,
    );
    // Board glyphs opt out of scaling via the named constant.
    expect(screen.getByTestId('glyph').props.maxFontSizeMultiplier).toBe(1);
  });

  it('passes allowFontScaling={false} through for hard glyph opt-out', async () => {
    await render(
      <ThemedText testID="fixed" allowFontScaling={false}>
        ▲
      </ThemedText>,
    );
    const node = screen.getByTestId('fixed');
    expect(node.props.allowFontScaling).toBe(false);
    // The cap stays present and inert while scaling is disabled.
    expect(node.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
  });
});
