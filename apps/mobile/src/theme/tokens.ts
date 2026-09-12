/**
 * Design tokens — single source of truth for the app's visual language.
 *
 * Everything visual (colour, spacing, type, radii, elevation, motion, layout)
 * comes from this file. Screens and components must not hardcode magic colours
 * or sizes; add a token here instead of inventing a one-off value.
 *
 * Design language v3 (campaign 026) — "Neon Arcade":
 *   warm-paper light theme and deep-plum ink dark theme, vermillion primary,
 *   volt rewards and violet progression, eight vivid domain identities, chunky
 *   rounded geometry, tactile buttons with a physical lip, and heavier display
 *   type. Clarity stays first; the arcade energy is the identity.
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
    accent: { base: '#D6402A', text: '#C43A22', soft: '#FFE7E1', softText: '#A62B18', on: '#FFFFFF' },
    success: { base: '#157347', text: '#157347', soft: '#DDF6E4', softText: '#0F5132', on: '#FFFFFF' },
    warning: { base: '#B45309', text: '#9A4A08', soft: '#FEF0D3', softText: '#7A3B06', on: '#FFFFFF' },
    danger: { base: '#C92A20', text: '#B42318', soft: '#FEE4E2', softText: '#912018', on: '#FFFFFF' },
    info: { base: '#1E63D0', text: '#175CD3', soft: '#DCEBFD', softText: '#12469E', on: '#FFFFFF' },
    streak: { base: '#C2410C', text: '#B03A0A', soft: '#FFE8D7', softText: '#8F3208', on: '#FFFFFF' },
    xp: { base: '#7C3AED', text: '#6D28D9', soft: '#EDE9FE', softText: '#5B21B6', on: '#FFFFFF' },
    currency: { base: '#A16207', text: '#8A5406', soft: '#F7EFDD', softText: '#6F4405', on: '#FFFFFF' },
  },
  dark: {
    // Dark-mode fills are luminous with dark text on them (`on`), which is what
    // keeps CTAs readable on the ink canvas; see the contrast test.
    accent: { base: '#FF8A73', text: '#FF9C88', soft: '#3A1F22', softText: '#FFB4A3', on: '#2A0F0A' },
    success: { base: '#4ADE80', text: '#6EE7A0', soft: '#16301F', softText: '#86EFAC', on: '#062B14' },
    warning: { base: '#FBBF24', text: '#FCD34D', soft: '#3A2E12', softText: '#FDE68A', on: '#3A2500' },
    danger: { base: '#FF7A7A', text: '#FF9B9B', soft: '#3A1B1F', softText: '#FFB4B4', on: '#330B0B' },
    info: { base: '#6AA9FF', text: '#8FC0FF', soft: '#17263F', softText: '#A9CEFF', on: '#0A1B33' },
    streak: { base: '#FF9A4D', text: '#FFB067', soft: '#3A2413', softText: '#FFC48F', on: '#331500' },
    xp: { base: '#B79CFF', text: '#C4ADFF', soft: '#2A2145', softText: '#D6C7FF', on: '#1C1033' },
    currency: { base: '#5EEAD4', text: '#7DF0DE', soft: '#123430', softText: '#A0F5E8', on: '#042A24' },
  },
} as const satisfies { light: Record<SemanticName, ColorFamily>; dark: Record<SemanticName, ColorFamily> };

/**
 * Domain identity colours. A user learns "Memory is indigo, Speed is gold"
 * once and recognises it in the library, in charts and on mastery surfaces.
 */
export const DomainColors = {
  light: {
    memory: { base: '#BE185D', text: '#BE185D', soft: '#FCE7F3', softText: '#9D174D', on: '#FFFFFF' },
    attention: { base: '#C2410C', text: '#B03A0A', soft: '#FFE8D7', softText: '#8F3208', on: '#FFFFFF' },
    speed: { base: '#A16207', text: '#854D0E', soft: '#FEF3C7', softText: '#713F12', on: '#FFFFFF' },
    math: { base: '#1D4ED8', text: '#1D4ED8', soft: '#E4EBFF', softText: '#1E40AF', on: '#FFFFFF' },
    language: { base: '#0369A1', text: '#0369A1', soft: '#E0F2FE', softText: '#075985', on: '#FFFFFF' },
    logic: { base: '#0F766E', text: '#0F766E', soft: '#D9F2EF', softText: '#115E59', on: '#FFFFFF' },
    flexibility: { base: '#7C3AED', text: '#6D28D9', soft: '#EDE9FE', softText: '#5B21B6', on: '#FFFFFF' },
    spatial: { base: '#15803D', text: '#15803D', soft: '#DCFCE7', softText: '#166534', on: '#FFFFFF' },
  },
  dark: {
    memory: { base: '#F472B6', text: '#F9A8D4', soft: '#3A1D2E', softText: '#FBCFE8', on: '#3A0A22' },
    attention: { base: '#FB923C', text: '#FDBA74', soft: '#3A2413', softText: '#FED7AA', on: '#331500' },
    speed: { base: '#FACC15', text: '#FDE047', soft: '#3A3210', softText: '#FEF08A', on: '#3A2A00' },
    math: { base: '#60A5FA', text: '#93C5FD', soft: '#182740', softText: '#BFDBFE', on: '#0A1B33' },
    language: { base: '#38BDF8', text: '#7DD3FC', soft: '#122A3D', softText: '#BAE6FD', on: '#04263A' },
    logic: { base: '#2DD4BF', text: '#5EEAD4', soft: '#11302C', softText: '#99F6E4', on: '#042A24' },
    flexibility: { base: '#A78BFA', text: '#C4B5FD', soft: '#271F44', softText: '#DDD6FE', on: '#1C1033' },
    spatial: { base: '#4ADE80', text: '#86EFAC', soft: '#16301F', softText: '#BBF7D0', on: '#052B12' },
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
  /** Floating overlay banner surface (reward celebration), theme-invariant. */
  overlaySurface: string;
  /** Primary copy on overlay surfaces. */
  overlayText: string;
  /** Secondary copy on overlay surfaces. */
  overlayTextMuted: string;
}

const NEUTRALS = {
  light: {
    text: '#1A1B2E',
    textSecondary: '#5B5E77',
    textMuted: '#6E7189',
    background: '#FFF8EF',
    backgroundElement: '#F6EEE2',
    backgroundSelected: '#F3E4D3',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F6EEE2',
    border: '#EADFD0',
    borderStrong: '#6E6A5E',
    accentStrong: '#B23522',
    scrim: 'rgba(26, 18, 12, 0.55)',
    overlaySurface: 'rgba(20, 22, 34, 0.92)',
    overlayText: '#FFFFFF',
    overlayTextMuted: '#D9DCE8',
  },
  dark: {
    text: '#F6F1E7',
    textSecondary: '#B3AEC6',
    textMuted: '#9A94AF',
    background: '#14102A',
    backgroundElement: '#100C22',
    backgroundSelected: '#2A2447',
    surface: '#1E1838',
    surfaceRaised: '#251E44',
    surfaceSunken: '#110D24',
    border: '#322A52',
    borderStrong: '#7A7396',
    accentStrong: '#FF9C88',
    scrim: 'rgba(6, 4, 14, 0.68)',
    overlaySurface: 'rgba(20, 22, 34, 0.92)',
    overlayText: '#FFFFFF',
    overlayTextMuted: '#D9DCE8',
  },
} as const satisfies { light: NeutralTheme; dark: NeutralTheme };

/**
 * Flat colour theme: neutral slots plus every family slot under its own key
 * (`accent`, `accentText`, `accentSoft`, `accentSoftText`, `accentOn`, …).
 * The flat shape is what `themeColor="accentSoft"` and `ThemedView type=` use.
 */
export type ColorTheme = NeutralTheme &
  Record<SemanticName, string> &
  Record<`${SemanticName}Text` | `${SemanticName}Soft` | `${SemanticName}SoftText` | `${SemanticName}On`, string> &
  Record<DomainName, string> &
  Record<`${DomainName}Text` | `${DomainName}Soft` | `${DomainName}SoftText` | `${DomainName}On`, string>;

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
 * Expand domain identities into the flat key space too (`memory`, `memorySoft`, …),
 * so callers can colour category chrome with `themeColor="memorySoft"` or
 * `Card tone="memorySoft"` instead of importing `DomainColors` and reading the
 * scheme themselves. Campaign 026 surface packets needed exactly this.
 */
function flattenDomains(domains: Record<DomainName, ColorFamily>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, family] of Object.entries(domains)) {
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
  light: {
    ...NEUTRALS.light,
    ...flattenFamilies(Families.light),
    ...flattenDomains(DomainColors.light),
  } as ColorTheme,
  dark: {
    ...NEUTRALS.dark,
    ...flattenFamilies(Families.dark),
    ...flattenDomains(DomainColors.dark),
  } as ColorTheme,
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

/**
 * Depth shading for physical edges. A translucent black always reads as
 * "recessed/under" on saturated, luminous and white surfaces in both themes,
 * which is exactly the button-lip / spark-core shading language; keeping it
 * here stops screens from inventing their own translucency (Campaign 026 R6).
 */
export const Depth = {
  /** 4 dp bottom edge under a filled button face. */
  lip: 'rgba(0, 0, 0, 0.24)',
  /** Centre node of the Spark identity mark. */
  core: 'rgba(0, 0, 0, 0.32)',
} as const;

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
  extraSmall: 8,
  small: 10,
  medium: 16,
  large: 22,
  extraLarge: 30,
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
  eyebrow: { size: 11, lineHeight: 14, weight: '800', tracking: 1 },
  /** Small labels, captions, metadata. */
  caption: { size: 12, lineHeight: 16, weight: '500' },
  /** Form/detail labels that pair with a value. */
  label: { size: 13, lineHeight: 18, weight: '700' },
  /** Secondary body text. */
  bodySmall: { size: 14, lineHeight: 20, weight: '500' },
  /** Primary body text. */
  body: { size: 16, lineHeight: 24, weight: '500' },
  /** Emphasis within body copy. */
  bodyLarge: { size: 17, lineHeight: 24, weight: '600' },
  /** Section headers. */
  headline: { size: 24, lineHeight: 30, weight: '800', tracking: -0.3 },
  /** Screen titles. */
  title: { size: 30, lineHeight: 36, weight: '800', tracking: -0.6 },
  /** Hero/dashboard display. */
  display: { size: 38, lineHeight: 44, weight: '900', tracking: -1 },
  /** Inline metric (rows, chips). */
  numeral: { size: 20, lineHeight: 24, weight: '800', tabular: true },
  /** Card-level metric. */
  numeralLg: { size: 30, lineHeight: 34, weight: '900', tabular: true, tracking: -0.6 },
  /** Hero metric (rings, results headline). */
  numeralXl: { size: 44, lineHeight: 48, weight: '900', tabular: true, tracking: -1.2 },
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
    boxShadow: '0 1px 2px rgba(64, 38, 12, 0.05), 0 6px 18px rgba(64, 38, 12, 0.07)',
    elevation: 3,
  },
  /** Raised surfaces: reward/completion cards and primary CTAs. */
  raised: { boxShadow: '0 3px 0 rgba(64, 38, 12, 0.10), 0 8px 24px rgba(64, 38, 12, 0.13)', elevation: 6 },
  /** The hero surface of a screen. */
  hero: { boxShadow: '0 4px 0 rgba(64, 38, 12, 0.12), 0 16px 40px rgba(64, 38, 12, 0.18)', elevation: 10 },
  /** Overlays/modals above everything. */
  overlay: { boxShadow: '0 24px 56px rgba(26, 12, 4, 0.34)', elevation: 16 },
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
  base: 220,
  /** Card/modal entrance. */
  entrance: 280,
  /** Hero/celebration entrance. */
  hero: 340,
  /** Bounded celebration period (auto-dismiss). */
  celebration: 700,
  /** Delay between staggered children of a mounting group. */
  stagger: 60,
  /** Maximum travel distance (dp) for an entrance transition. */
  travel: 14,
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
  press: { damping: 20, stiffness: 380, mass: 0.6 },
  progress: { damping: 16, stiffness: 200, mass: 0.8 },
  hero: { damping: 12, stiffness: 150, mass: 1 },
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
