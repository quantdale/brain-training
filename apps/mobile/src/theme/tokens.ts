/**
 * Design tokens — single source of truth for the app's visual language.
 *
 * Everything visual (colour, spacing, type, radii, elevation, motion, layout)
 * comes from this file. Screens and components must not hardcode magic colours
 * or sizes; add a token here instead of inventing a one-off value.
 *
 * Design language v2 (campaign 024) — "Playful Precision":
 *   clarity first (Elevate), energy second (Duolingo/Brilliant). One hero per
 *   screen, one primary action per viewport, three type weights, stable metric
 *   identity colours.
 *
 * Colour contract: every family exposes five slots so callers pick the right
 * one instead of guessing contrast:
 *   - `base`      filled surfaces (buttons, chart fills, badges)  ≥3:1 vs surface
 *   - `text`      that family as text on surface/background       ≥4.5:1
 *   - `soft`      tinted background for cards, chips, rows
 *   - `softText`  text drawn on `soft`                            ≥4.5:1
 *   - `on`        text/glyph drawn on `base`                      ≥4.5:1
 * `theme/__tests__/contrast.test.ts` asserts every one of those ratios in both
 * schemes, so a palette edit that breaks accessibility fails the build.
 */

import { Platform, type TextStyle } from 'react-native';

// Web-only: `global.css` defines the `--font-*` CSS variables referenced by
// `Fonts` below. Kept out of the native/test bundles (jest has no CSS
// transform, so a static import would break the test pipeline).
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/global.css');
}

/** Slot structure shared by every coloured family (semantic + domain). */
export interface ColorFamily {
  /** Filled surface (buttons, chart fills, badges). */
  base: string;
  /** The family used as text on surface/background. */
  text: string;
  /** Tinted background for cards, chips and rows. */
  soft: string;
  /** Text drawn on `soft`. */
  softText: string;
  /** Text or glyph drawn on `base`. */
  on: string;
}

/** Semantic colour family names. */
export type SemanticName =
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'streak'
  | 'xp'
  | 'currency';

/** Domain identity colour names (constitution §8 browse categories). */
export type DomainName =
  | 'memory'
  | 'attention'
  | 'speed'
  | 'math'
  | 'language'
  | 'logic'
  | 'flexibility'
  | 'spatial';

/**
 * Semantic families. Engagement tones (`streak`, `xp`) stay distinct from the
 * primary CTA accent so a reward never reads as a navigation action.
 */
export const Families = {
  light: {
    accent: { base: '#2563EB', text: '#2563EB', soft: '#E9EFFD', softText: '#2461E7', on: '#FFFFFF' },
    success: { base: '#15803D', text: '#15803D', soft: '#E8F2EC', softText: '#147C3B', on: '#FFFFFF' },
    warning: { base: '#B45309', text: '#B45309', soft: '#F8EEE6', softText: '#B15209', on: '#FFFFFF' },
    danger: { base: '#DC2626', text: '#D82525', soft: '#FCE9E9', softText: '#D12424', on: '#FFFFFF' },
    info: { base: '#0284C7', text: '#0277B4', soft: '#E6F3F9', softText: '#0272AC', on: '#0F1117' },
    streak: { base: '#EA580C', text: '#C4490A', soft: '#FDEEE7', softText: '#BB460A', on: '#0F1117' },
    xp: { base: '#7C3AED', text: '#7C3AED', soft: '#F2EBFD', softText: '#7C3AED', on: '#FFFFFF' },
    currency: { base: '#A16207', text: '#A16207', soft: '#F6EFE6', softText: '#9C5F07', on: '#FFFFFF' },
  },
  dark: {
    // Dark-mode fills are luminous with dark text on them (`on`), which is what
    // keeps CTAs readable on a dark canvas; see the contrast test.
    accent: { base: '#7BA0F5', text: '#7BA0F5', soft: '#20283B', softText: '#7BA0F5', on: '#0F1117' },
    success: { base: '#4ADE80', text: '#4ADE80', soft: '#183228', softText: '#4ADE80', on: '#0F1117' },
    warning: { base: '#FBBF24', text: '#FBBF24', soft: '#352D19', softText: '#FBBF24', on: '#0F1117' },
    danger: { base: '#F87171', text: '#F87171', soft: '#342025', softText: '#F87171', on: '#0F1117' },
    info: { base: '#7DD3FC', text: '#7DD3FC', soft: '#21303C', softText: '#7DD3FC', on: '#0F1117' },
    streak: { base: '#FB923C', text: '#FB923C', soft: '#35261D', softText: '#FB923C', on: '#0F1117' },
    xp: { base: '#C4B5FD', text: '#C4B5FD', soft: '#2C2B3C', softText: '#C4B5FD', on: '#0F1117' },
    currency: { base: '#5EEAD4', text: '#5EEAD4', soft: '#1C3435', softText: '#5EEAD4', on: '#0F1117' },
  },
} as const satisfies { light: Record<SemanticName, ColorFamily>; dark: Record<SemanticName, ColorFamily> };

/**
 * Domain identity colours. A user learns "Memory is indigo, Speed is gold"
 * once and recognises it in the library, in charts and on mastery surfaces.
 */
export const DomainColors = {
  light: {
    memory: { base: '#4338CA', text: '#4338CA', soft: '#ECEBFA', softText: '#4338CA', on: '#FFFFFF' },
    attention: { base: '#BE123C', text: '#BE123C', soft: '#F8E7EC', softText: '#BE123C', on: '#FFFFFF' },
    speed: { base: '#A16207', text: '#A16207', soft: '#F6EFE6', softText: '#9C5F07', on: '#FFFFFF' },
    math: { base: '#1D4ED8', text: '#1D4ED8', soft: '#E8EDFB', softText: '#1D4ED8', on: '#FFFFFF' },
    language: { base: '#047857', text: '#047857', soft: '#E6F2EE', softText: '#047857', on: '#FFFFFF' },
    logic: { base: '#7E22CE', text: '#7E22CE', soft: '#F2E9FA', softText: '#7E22CE', on: '#FFFFFF' },
    flexibility: { base: '#A21CAF', text: '#A21CAF', soft: '#F6E8F7', softText: '#A21CAF', on: '#FFFFFF' },
    spatial: { base: '#0E7490', text: '#0E7490', soft: '#E7F1F4', softText: '#0E7490', on: '#FFFFFF' },
  },
  dark: {
    memory: { base: '#A5B4FC', text: '#A5B4FC', soft: '#272B3C', softText: '#A5B4FC', on: '#0F1117' },
    attention: { base: '#FDA4AF', text: '#FDA4AF', soft: '#35292F', softText: '#FDA4AF', on: '#0F1117' },
    speed: { base: '#FCD34D', text: '#FCD34D', soft: '#353020', softText: '#FCD34D', on: '#0F1117' },
    math: { base: '#93C5FD', text: '#93C5FD', soft: '#242E3C', softText: '#93C5FD', on: '#0F1117' },
    language: { base: '#6EE7B7', text: '#6EE7B7', soft: '#1E3331', softText: '#6EE7B7', on: '#0F1117' },
    logic: { base: '#D8B4FE', text: '#D8B4FE', soft: '#2F2B3C', softText: '#D8B4FE', on: '#0F1117' },
    flexibility: { base: '#F0ABFC', text: '#F0ABFC', soft: '#332A3C', softText: '#F0ABFC', on: '#0F1117' },
    spatial: { base: '#67E8F9', text: '#67E8F9', soft: '#1D333B', softText: '#67E8F9', on: '#0F1117' },
  },
} as const satisfies { light: Record<DomainName, ColorFamily>; dark: Record<DomainName, ColorFamily> };

/** Canonical domain order used by charts, legends and filters. */
export const DOMAIN_ORDER: readonly DomainName[] = [
  'memory',
  'attention',
  'speed',
  'math',
  'language',
  'logic',
  'flexibility',
  'spatial',
];

/** Neutral slots: canvas, surfaces, borders and copy. */
interface NeutralTheme {
  /** Primary copy colour. */
  text: string;
  /** Secondary copy: labels, supporting lines. */
  textSecondary: string;
  /** Tertiary copy: metadata and captions on muted surfaces. */
  textMuted: string;
  /** Page background behind cards. */
  background: string;
  /** Legacy surface key kept for template-derived components (ThemedView). */
  backgroundElement: string;
  /** Legacy selected-row surface key kept for template-derived components. */
  backgroundSelected: string;
  /** Card/sheet surface above the page background. */
  surface: string;
  /** Surface for the hero/elevated card of a screen. */
  surfaceRaised: string;
  /** Recessed surface for wells, tracks and inline code. */
  surfaceSunken: string;
  /** Decorative hairline border. */
  border: string;
  /** Interactive boundary (inputs, toggles, outlines) — ≥3:1 vs surface. */
  borderStrong: string;
  /** Pressed/active variant of the brand accent (tactile button states). */
  accentStrong: string;
  /** Scrim behind completion/celebration overlays. */
  scrim: string;
}

const NEUTRALS = {
  light: {
    text: '#131829',
    textSecondary: '#5A6377',
    textMuted: '#666F82',
    background: '#F4F6FC',
    backgroundElement: '#EDF0F8',
    backgroundSelected: '#E4E9F5',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#EDF0F8',
    border: '#E4E8F2',
    borderStrong: '#8A94AC',
    accentStrong: '#1E51C1',
    scrim: 'rgba(14, 16, 22, 0.55)',
  },
  dark: {
    text: '#F3F5FA',
    textSecondary: '#A7AEC0',
    textMuted: '#939BAD',
    background: '#0F1117',
    backgroundElement: '#0B0D12',
    backgroundSelected: '#262B38',
    surface: '#171A23',
    surfaceRaised: '#1E222C',
    surfaceSunken: '#0B0D12',
    border: '#2A2F3C',
    borderStrong: '#67728A',
    accentStrong: '#93B1F7',
    scrim: 'rgba(0, 0, 0, 0.65)',
  },
} as const satisfies { light: NeutralTheme; dark: NeutralTheme };

/**
 * Flat colour theme: neutral slots plus every family slot under its own key
 * (`accent`, `accentText`, `accentSoft`, `accentSoftText`, `accentOn`, …).
 * The flat shape is what `themeColor="accentSoft"` and `ThemedView type=` use.
 */
export type ColorTheme = NeutralTheme &
  Record<SemanticName, string> &
  Record<`${SemanticName}Text` | `${SemanticName}Soft` | `${SemanticName}SoftText` | `${SemanticName}On`, string>;

/** Expand structured families into the flat key space. */
function flattenFamilies(families: Record<SemanticName, ColorFamily>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, family] of Object.entries(families)) {
    flat[name] = family.base;
    flat[`${name}Text`] = family.text;
    flat[`${name}Soft`] = family.soft;
    flat[`${name}SoftText`] = family.softText;
    flat[`${name}On`] = family.on;
  }
  return flat;
}

/**
 * Light + dark colour palettes. Built from {@link NEUTRALS} and
 * {@link Families} so a value exists in exactly one place; the spread result
 * matches {@link ColorTheme} by construction (verified by the token test).
 */
export const Colors: { readonly light: ColorTheme; readonly dark: ColorTheme } = {
  light: { ...NEUTRALS.light, ...flattenFamilies(Families.light) } as ColorTheme,
  dark: { ...NEUTRALS.dark, ...flattenFamilies(Families.dark) } as ColorTheme,
};

/** Semantic colour slot usable by themed components (`ThemedView`, `ThemedText`). */
export type ThemeColor = keyof ColorTheme;

/**
 * Metric identity — a metric keeps the same colour everywhere it appears
 * (results, progress, home), so users learn the colour language once.
 */
export const METRIC_COLOR_KEYS = {
  xp: 'xp',
  streak: 'streak',
  time: 'info',
  accuracy: 'success',
  currency: 'currency',
  score: 'accent',
} as const satisfies Record<string, ThemeColor>;

/** Metric identifier accepted by metric-aware components. */
export type MetricName = keyof typeof METRIC_COLOR_KEYS;

/** System font families per platform (web values are CSS vars from global.css). */
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** 4pt-based spacing scale. Names are relative (half → six), like the scaffold. */
export const Spacing = {
  half: 2,
  one: 4,
  oneHalf: 6,
  two: 8,
  twoHalf: 12,
  three: 16,
  threeHalf: 20,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii scale. */
export const Radii = {
  extraSmall: 6,
  small: 8,
  medium: 12,
  large: 20,
  extraLarge: 28,
  pill: 999,
} as const;

/** One step of the type scale. */
export interface TypographyToken {
  size: number;
  lineHeight: number;
  weight: TextStyle['fontWeight'];
  /** Letter spacing in dp (negative tightens display styles). */
  tracking?: number;
  /** Marks numeral styles: fixed digit advance so counters never reflow. */
  tabular?: boolean;
}

/**
 * Typography scale. Weights stay as string literals so they can be spread into
 * styles without narrowing. Hero numerals (`numeral*`) are tabular so animated
 * counters cannot shift the layout around them.
 */
export const Typography: Record<
  | 'eyebrow'
  | 'caption'
  | 'label'
  | 'bodySmall'
  | 'body'
  | 'bodyLarge'
  | 'headline'
  | 'title'
  | 'display'
  | 'numeral'
  | 'numeralLg'
  | 'numeralXl',
  TypographyToken
> = {
  /** Uppercase section eyebrow above a title. */
  eyebrow: { size: 12, lineHeight: 16, weight: '700', tracking: 0.8 },
  /** Small labels, captions, metadata. */
  caption: { size: 12, lineHeight: 16, weight: '500' },
  /** Form/detail labels that pair with a value. */
  label: { size: 13, lineHeight: 18, weight: '600' },
  /** Secondary body text. */
  bodySmall: { size: 14, lineHeight: 20, weight: '500' },
  /** Primary body text. */
  body: { size: 16, lineHeight: 24, weight: '500' },
  /** Emphasis within body copy. */
  bodyLarge: { size: 18, lineHeight: 26, weight: '500' },
  /** Section headers. */
  headline: { size: 22, lineHeight: 28, weight: '700', tracking: -0.2 },
  /** Screen titles. */
  title: { size: 28, lineHeight: 34, weight: '700', tracking: -0.4 },
  /** Hero/dashboard display. */
  display: { size: 36, lineHeight: 42, weight: '800', tracking: -0.8 },
  /** Inline metric (rows, chips). */
  numeral: { size: 20, lineHeight: 24, weight: '700', tabular: true },
  /** Card-level metric. */
  numeralLg: { size: 28, lineHeight: 32, weight: '800', tabular: true, tracking: -0.4 },
  /** Hero metric (rings, results headline). */
  numeralXl: { size: 40, lineHeight: 44, weight: '800', tabular: true, tracking: -1 },
};

/** Typography token name accepted by themed text. */
export type TypographyName = keyof typeof Typography;

/**
 * Bottom inset reserved for the floating web tab bar.
 *
 * Platform keys are explicit so no platform silently falls into `undefined`
 * (campaign009 audit A2: without a `web`/`default` key the value resolved to
 * 0 on web, letting the floating pill bar overlap the last content row).
 * Native tab hosts absorb the device bottom inset themselves; pushed native
 * routes must use their real safe-area inset instead (see
 * `components/screen-shell.tsx`, audit B5).
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 64, default: 0 }) ?? 0;

/** One level of the elevation ramp. */
export interface ElevationLevel {
  boxShadow: string;
  elevation: number;
}

/**
 * Elevation ramp. Monotonic visual weight so callers can order surfaces by
 * importance; every level defines both `boxShadow` (iOS/web) and `elevation`
 * (Android), because RN 0.82 deprecates the `shadow*` style props (their
 * deprecation warning docks LogBox over bottom controls).
 */
export const Elevation: Record<'none' | 'flat' | 'card' | 'raised' | 'hero' | 'overlay', ElevationLevel> = {
  none: { boxShadow: 'none', elevation: 0 },
  /** Recessed/grouped content that must not compete. */
  flat: { boxShadow: 'none', elevation: 0 },
  /** Default card lift above the page background. */
  card: {
    boxShadow: '0 1px 2px rgba(16, 20, 40, 0.06), 0 4px 14px rgba(16, 20, 40, 0.06)',
    elevation: 2,
  },
  /** Raised surfaces: reward/completion cards and primary CTAs. */
  raised: { boxShadow: '0 6px 20px rgba(16, 20, 40, 0.14)', elevation: 6 },
  /** The hero surface of a screen. */
  hero: { boxShadow: '0 12px 32px rgba(16, 20, 40, 0.18)', elevation: 10 },
  /** Overlays/modals above everything. */
  overlay: { boxShadow: '0 20px 48px rgba(8, 10, 24, 0.32)', elevation: 16 },
};

/** Elevation level name. */
export type ElevationName = keyof typeof Elevation;

/**
 * Motion durations (ms) for the shared interaction language. Short and
 * non-blocking; celebration is bounded so it can never trap input.
 */
export const Motion = {
  /** Press-in scale feedback. */
  press: 90,
  /** Small state changes (chips, meters). */
  quick: 140,
  /** Standard entrance/fade. */
  base: 200,
  /** Card/modal entrance. */
  entrance: 260,
  /** Hero/celebration entrance. */
  hero: 320,
  /** Bounded celebration period (auto-dismiss). */
  celebration: 650,
  /** Delay between staggered children of a mounting group. */
  stagger: 60,
  /** Maximum travel distance (dp) for an entrance transition. */
  travel: 12,
} as const;

/** Spring physics preset (RN `Animated.spring` / Reanimated `withSpring`). */
export interface SpringPreset {
  damping: number;
  stiffness: number;
  mass: number;
}

/**
 * Spring presets for motion that should feel physical rather than timed:
 * press feedback (snappy, no visible overshoot) and progress fills (settle
 * with a slight overshoot that reads as "counted up").
 */
export const Springs: Record<'press' | 'progress' | 'hero', SpringPreset> = {
  press: { damping: 22, stiffness: 340, mass: 0.7 },
  progress: { damping: 18, stiffness: 180, mass: 0.9 },
  hero: { damping: 14, stiffness: 160, mass: 1 },
};

/** Spring preset name. */
export type SpringName = keyof typeof Springs;

/**
 * Layout breakpoints. `compact` is phone portrait, `medium` small tablets and
 * landscape phones, `expanded` tablets and wide web views. Consumed through
 * `@/platform/layout` hooks so screens never read raw widths.
 */
export const Breakpoints = {
  compact: 480,
  medium: 768,
} as const;

/** Named layout tier derived from the viewport width. */
export type LayoutTier = 'compact' | 'medium' | 'expanded';

/** Horizontal page gutter per layout tier. */
export const ScreenGutter: Record<LayoutTier, number> = {
  compact: 16,
  medium: 20,
  expanded: 28,
};

/** Number of columns a content grid should use per layout tier. */
export const GridColumns: Record<LayoutTier, number> = {
  compact: 1,
  medium: 2,
  expanded: 3,
};

/** Max content width for phone-first screens; content centers within it. */
export const MaxContentWidth = 800;

/** Max content width once the viewport is wide enough for a two-column body. */
export const WideContentWidth = 960;

/** Layout breakpoints consumed by the responsive helpers in `@/platform/layout`. */
export const CompactLayoutMaxWidth = Breakpoints.compact;
export const MediumLayoutMaxWidth = Breakpoints.medium;

/**
 * Minimum interactive target (dp) — WCAG 2.5.5 / platform guidance.
 * Mirrors `@/platform/touch` so style-only callers can reference it.
 */
export const MinTouchTarget = 44;

/**
 * Reference height of the iOS home-indicator / Android gesture-navigation
 * bottom zone (~34pt on notched iPhones). Documentation/QA reference value:
 * runtime code should prefer the real safe-area inset reported by
 * `react-native-safe-area-context` over this static estimate.
 */
export const HomeIndicatorInset = 34;
