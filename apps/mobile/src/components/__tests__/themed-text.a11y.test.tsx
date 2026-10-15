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
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import {
  BOARD_GLYPH_FONT_SCALE,
  DISPLAY_FONT_SCALE,
  FONT_SCALE_CAP,
  HEADING_FONT_SCALE,
  MAX_FONT_SCALE,
} from '@/components/a11y/font-scale';
import { ThemedText } from '@/components/themed-text';
import { SectionHeader } from '@/components/shell/section-header';
import { Card } from '@/components/ui/card';
import { Typography } from '@/theme/tokens';

const mockViewport = { width: 411, height: 866, scale: 2.625, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockViewport,
}));

beforeEach(() => {
  mockViewport.fontScale = 1;
});
afterEach(() => {
  jest.restoreAllMocks();
});

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

describe('Android enlarged heading metrics', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
    mockViewport.fontScale = 2;
  });

  // These are the two real caller shapes whose Android 2× screenshots cut
  // g/y ink at the Text bounds. Jest checks the shared/native style seam;
  // only a rebuilt APK and the original pixel probes can accept the repair.
  it('lets the Games section heading use its native font metrics', async () => {
    await render(<SectionHeader title="Suggested next" />);
    const heading = screen.getByText('Suggested next');
    expect(StyleSheet.flatten(heading.props.style).lineHeight).toBeUndefined();
    expect(heading.props.maxFontSizeMultiplier).toBe(HEADING_FONT_SCALE);
  });

  it('lets the Activity card heading use its native font metrics', async () => {
    await render(<Card><ThemedText type="headline">Training days</ThemedText></Card>);
    expect(StyleSheet.flatten(screen.getByText('Training days').props.style).lineHeight).toBeUndefined();
  });

  it.each(['headline', 'title', 'display', 'gameTitle', 'resultHeadline'] as const)(
    'keeps %s glyph size and its role cap while using native heading metrics', async (type) => {
      await render(<ThemedText type={type} testID="heading">Activity</ThemedText>);
      const heading = screen.getByTestId('heading');
      expect(StyleSheet.flatten(heading.props.style)).toMatchObject({ fontSize: Typography[type].size });
      expect(StyleSheet.flatten(heading.props.style).lineHeight).toBeUndefined();
      expect(heading.props.maxFontSizeMultiplier).toBe(FONT_SCALE_CAP[type]);
    },
  );

  it('keeps normal-size heading geometry and responds to a system font change', async () => {
    mockViewport.fontScale = 1;
    const view = await render(<SectionHeader title="Suggested next" />);
    expect(StyleSheet.flatten(screen.getByText('Suggested next').props.style).lineHeight).toBe(Typography.headline.lineHeight);
    mockViewport.fontScale = 2;
    await view.rerender(<SectionHeader title="Suggested next" />);
    expect(StyleSheet.flatten(screen.getByText('Suggested next').props.style).lineHeight).toBeUndefined();
  });

  it.each(['ios', 'web'] as const)('preserves %s line-height behavior', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    await render(<ThemedText type="headline" testID="heading">Training days</ThemedText>);
    expect(StyleSheet.flatten(screen.getByTestId('heading').props.style).lineHeight).toBe(Typography.headline.lineHeight);
  });

  it('preserves pre-Android14 linear font scaling', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    await render(<ThemedText type="headline" testID="heading">Training days</ThemedText>);
    expect(StyleSheet.flatten(screen.getByTestId('heading').props.style).lineHeight).toBe(Typography.headline.lineHeight);
  });

  it('preserves explicitly sized glyphs and caller line-height overrides', async () => {
    await render(<>
      <ThemedText type="headline" testID="fixed" allowFontScaling={false}>y</ThemedText>
      <ThemedText type="headline" testID="cap" maxFontSizeMultiplier={1}>g</ThemedText>
      <ThemedText type="headline" testID="override" style={[{ lineHeight: 44 }, { lineHeight: 48 }]}>Training days</ThemedText>
      <ThemedText type="body" testID="body">Reading copy</ThemedText>
    </>);
    expect(StyleSheet.flatten(screen.getByTestId('fixed').props.style).lineHeight).toBe(Typography.headline.lineHeight);
    expect(StyleSheet.flatten(screen.getByTestId('cap').props.style).lineHeight).toBe(Typography.headline.lineHeight);
    expect(StyleSheet.flatten(screen.getByTestId('override').props.style).lineHeight).toBe(48);
    expect(StyleSheet.flatten(screen.getByTestId('body').props.style).lineHeight).toBe(Typography.body.lineHeight);
  });
});
