/**
 * ThemedText dynamic-type contract rendered assertions (campaign 011 W14).
 *
 * Campaign 010 introduced the ~1.35 font-scale cap (xplat audit B1) which
 * legitimately changed the visual-baseline snapshots; these tests pin the
 * PROP-LEVEL contract that snapshot diffs only implied:
 * - every ThemedText carries the default cap,
 * - explicit per-node overrides win (board glyphs pass 1),
 * - the `allowFontScaling={false}` glyph opt-out passes through untouched.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { BOARD_GLYPH_FONT_SCALE, MAX_FONT_SCALE } from '@/components/a11y/font-scale';
import { ThemedText } from '@/components/themed-text';

describe('ThemedText dynamic type', () => {
  it('applies the shared MAX_FONT_SCALE cap by default', async () => {
    await render(<ThemedText testID="t">Body copy</ThemedText>);
    expect(screen.getByTestId('t').props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    expect(MAX_FONT_SCALE).toBe(1.35);
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
