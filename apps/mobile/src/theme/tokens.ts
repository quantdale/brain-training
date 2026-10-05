/**
 * Design tokens — single source of truth for the app's visual language.
 *
 * Everything visual (colour, spacing, type, radii, elevation, motion, layout)
 * comes from this file. Screens and components must not hardcode magic colours
 * or sizes; add a token here instead of inventing a one-off value.
 *
 * Design language v5 (change 076) — "Training Studio" (REFERENCE_LOCK.md):
 *   studio paper + charcoal stage, one red primary action, white reading type,
 *   instrument-like metrics and mechanic-first play stages. Red is the CTA
 *   role ONLY; success/error always carry text+icon/shape beyond color. The
 *   palette is quiet where the product reports evidence and immersive where
 *   the player plays.
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
    // CTA red — the ONE primary action fill (REFERENCE_LOCK section 1); never error.
    accent: { base: '#D6293A', text: '#B8202F', soft: '#FBE3E5', softText: '#8F1622', on: '#FFFFFF' },
    success: { base: '#157A46', text: '#116939', soft: '#DFF2E7', softText: '#0F5230', on: '#FFFFFF' },
    warning: { base: '#8C5A00', text: '#795000', soft: '#FFF0C8', softText: '#604000', on: '#FFFFFF' },
    danger: { base: '#A32014', text: '#931C11', soft: '#F9E2DE', softText: '#7C180E', on: '#FFFFFF' },
    info: { base: '#0D628C', text: '#0B587D', soft: '#D9F1FA', softText: '#084764', on: '#FFFFFF' },
    streak: { base: '#A94318', text: '#963A14', soft: '#FFE3D4', softText: '#72300F', on: '#FFFFFF' },
    xp: { base: '#633BAF', text: '#58339D', soft: '#EDE4FA', softText: '#482A7E', on: '#FFFFFF' },
    currency: { base: '#705900', text: '#624D00', soft: '#F8EEC7', softText: '#4E3D00', on: '#FFFFFF' },
  },
  dark: {
    // Dark-mode fills are luminous with dark ink on them (`on`); the canvas is
    // a near-black studio surface and the CTA red brightens for dark ground.
    accent: { base: '#FF4A57', text: '#FF6E79', soft: '#3A1418', softText: '#FFB3BA', on: '#2B0508' },
    success: { base: '#4CC98A', text: '#6FD8A4', soft: '#12301F', softText: '#9AE8C0', on: '#06281A' },
    warning: { base: '#FFD166', text: '#FFDB82', soft: '#3C321A', softText: '#FFE6A3', on: '#332400' },
    danger: { base: '#FF7B67', text: '#FF9A89', soft: '#3A1410', softText: '#FFC0B5', on: '#340B07' },
    info: { base: '#69C9F0', text: '#8ADAF7', soft: '#143545', softText: '#A9E6FB', on: '#08212D' },
    streak: { base: '#FF9D5C', text: '#FFB77E', soft: '#3B281A', softText: '#FFD0A5', on: '#321506' },
    xp: { base: '#B99AFF', text: '#CBB3FF', soft: '#2A2248', softText: '#DFD0FF', on: '#1A1030' },
    currency: { base: '#62DEC9', text: '#83EBDD', soft: '#143C38', softText: '#A7F4E8', on: '#062B26' },
  },
} as const satisfies { light: Record<SemanticName, ColorFamily>; dark: Record<SemanticName, ColorFamily> };

/**
 * Domain identity colours. A user learns "Memory is indigo, Speed is gold"
 * once and recognises it in the library, in charts and on mastery surfaces.
 */
export const DomainColors = {
  light: {
    memory: { base: '#A52A5E', text: '#982554', soft: '#F8DFEA', softText: '#762046', on: '#FFFFFF' },
    attention: { base: '#B34A16', text: '#9F3F12', soft: '#FFE5D5', softText: '#83330D', on: '#FFFFFF' },
    speed: { base: '#8A6400', text: '#795700', soft: '#FFF0BE', softText: '#654800', on: '#FFFFFF' },
    math: { base: '#1B55B7', text: '#194DA6', soft: '#DEE9FF', softText: '#153D83', on: '#FFFFFF' },
    language: { base: '#086A86', text: '#075F79', soft: '#D9F3FA', softText: '#075166', on: '#FFFFFF' },
    logic: { base: '#0C6E66', text: '#0B625B', soft: '#D8F3EE', softText: '#07534E', on: '#FFFFFF' },
    flexibility: { base: '#6B36A5', text: '#603092', soft: '#EDE2FA', softText: '#512276', on: '#FFFFFF' },
    spatial: { base: '#0D743B', text: '#0C6936', soft: '#DDF5E7', softText: '#0C5A31', on: '#FFFFFF' },
  },
  dark: {
    memory: { base: '#F28BBC', text: '#FFB4D2', soft: '#422337', softText: '#FFD0E1', on: '#3A0D25' },
    attention: { base: '#FFAB70', text: '#FFC08E', soft: '#43291C', softText: '#FFD8B7', on: '#351506' },
    speed: { base: '#FFD75E', text: '#FFE28A', soft: '#423715', softText: '#FFEBAA', on: '#342800' },
    math: { base: '#78B5FF', text: '#A0CBFF', soft: '#1B304E', softText: '#C7E0FF', on: '#091D35' },
    language: { base: '#5AD3F3', text: '#8DE2F9', soft: '#153746', softText: '#BDEFFC', on: '#062B39' },
    logic: { base: '#55DDC6', text: '#83E8D7', soft: '#143A36', softText: '#B1F4E8', on: '#052B26' },
    flexibility: { base: '#C3A9FF', text: '#D4C0FF', soft: '#30264E', softText: '#E3D7FF', on: '#211337' },
    spatial: { base: '#6BE39A', text: '#91EEB3', soft: '#183A29', softText: '#B6F5CA', on: '#072B17' },
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
  /** Immersive play/result stage panel (change 076 lock section 1): charcoal
   *  in both schemes, always paired with {@link stageInk} copy. */
  stage: string;
  /** Reading type drawn on the stage panel. */
  stageInk: string;
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
    text: '#17181A',
    textSecondary: '#4A4B4E',
    textMuted: '#6E6E68',
    background: '#F7F6F3',
    backgroundElement: '#ECEAE5',
    backgroundSelected: '#E2E0DA',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#ECEAE5',
    stage: '#1F2124',
    stageInk: '#FFFFFF',
    border: '#D8D5CE',
    borderStrong: '#4A4B4E',
    accentStrong: '#B01E2E',
    scrim: 'rgba(12, 13, 15, 0.58)',
    overlaySurface: 'rgba(16, 17, 19, 0.94)',
    overlayText: '#FFFFFF',
    overlayTextMuted: '#D9D9D6',
  },
  dark: {
    text: '#F2F2F0',
    textSecondary: '#B9BABC',
    textMuted: '#9A9A94',
    background: '#101114',
    backgroundElement: '#17181B',
    backgroundSelected: '#26282C',
    surface: '#1B1D21',
    surfaceRaised: '#232629',
    surfaceSunken: '#0C0D0F',
    stage: '#1B1D21',
    stageInk: '#FFFFFF',
    border: '#34363B',
    borderStrong: '#A2A3A6',
    accentStrong: '#FF6E79',
    scrim: 'rgba(5, 6, 8, 0.72)',
    overlaySurface: 'rgba(10, 11, 13, 0.95)',
    overlayText: '#FFFFFF',
    overlayTextMuted: '#D9D9D6',
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

/**
 * Non-semantic art pigments used by the code-native Signal Arcade illustrations.
 * UI copy and controls still use `Colors`; these values are deliberately
 * stable so an eight-domain world keeps its recognizable poster ink in both
 * themes without leaking arbitrary hex values into screens.
 */
export const ArcadePalette = {
  light: {
    ink: '#17181A',
    paper: '#F7F6F3',
    paperBright: '#FFFFFF',
    coral: '#D6293A',
    cyan: '#167E9E',
    yellow: '#D9A514',
    mint: '#2E8B6A',
    violet: '#633BAF',
  },
  dark: {
    ink: '#0B0C0D',
    paper: '#101114',
    paperBright: '#1B1D21',
    coral: '#FF4A57',
    cyan: '#58B8D8',
    yellow: '#E8B93E',
    mint: '#4CC98A',
    violet: '#B99AFF',
  },
} as const;

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
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 22,
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
  | 'bodyRead'
  | 'bodyLarge'
  | 'headline'
  | 'title'
  | 'display'
  | 'gameTitle'
  | 'resultHeadline'
  | 'numeral'
  | 'numeralLg'
  | 'numeralXl',
  TypographyToken
> = {
  /** Uppercase section eyebrow above a title. */
  eyebrow: { size: 11.5, lineHeight: 14, weight: '800', tracking: 1.8 },
  /** Small labels, captions, metadata. */
  caption: { size: 12, lineHeight: 16, weight: '500' },
  /** Form/detail labels that pair with a value. */
  label: { size: 13, lineHeight: 18, weight: '700' },
  /** Secondary body text. */
  bodySmall: { size: 14, lineHeight: 20, weight: '500' },
  /** Primary body text. */
  body: { size: 16, lineHeight: 24, weight: '500' },
  /**
   * Long-form reading copy: rules, tutorial concepts, progress narrative.
   * Lighter and roomier than `body` so explanation never shouts like a
   * headline (campaign 055 role split).
   */
  bodyRead: { size: 16, lineHeight: 26, weight: '400' },
  /** Emphasis within body copy. */
  bodyLarge: { size: 17, lineHeight: 24, weight: '600' },
  /** Section headers. */
  headline: { size: 24, lineHeight: 30, weight: '800', tracking: -0.4 },
  /** Screen titles. */
  title: { size: 30, lineHeight: 34, weight: '800', tracking: -0.4 },
  /** Hero/dashboard display. */
  display: { size: 40, lineHeight: 44, weight: '800', tracking: -1.0 },
  /** Game names on stages, panels, tiles and detail (campaign 055 voice). */
  gameTitle: { size: 22, lineHeight: 26, weight: '800', tracking: -0.3 },
  /**
   * The single result band headline on Results. Deliberately heavier and
   * larger than `headline` so the emotional peak outranks surrounding
   * report copy (campaign 055).
   */
  resultHeadline: { size: 30, lineHeight: 34, weight: '800', tracking: -0.6 },
  /** Inline metric (rows, chips). */
  numeral: { size: 20, lineHeight: 24, weight: '800', tabular: true },
  /** Card-level metric. */
  numeralLg: { size: 30, lineHeight: 34, weight: '800', tabular: true, tracking: -0.6 },
  /** Hero metric (rings, results headline). */
  numeralXl: { size: 54, lineHeight: 58, weight: '800', tabular: true, tracking: -1.5 },
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
  /** Default card: hairline border instead of shadow (lock section 3). */
  card: { boxShadow: 'none', elevation: 0 },
  /** Raised surfaces: the immersive stage card and primary CTAs. */
  raised: { boxShadow: '0 10px 28px rgba(12, 13, 15, 0.14)', elevation: 4 },
  /** The hero surface of a screen. */
  hero: { boxShadow: '0 14px 36px rgba(12, 13, 15, 0.18)', elevation: 6 },
  /** Overlays/modals above everything. */
  overlay: { boxShadow: '0 24px 56px rgba(5, 6, 8, 0.34)', elevation: 16 },
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
 *
 * 071: this numeric duplicate is GONE. The canonical definition is
 * `MIN_TOUCH_TARGET` in `@/components/a11y/touch-target`, which also owns the
 * matching style fragment. Two exported names for one number is how a migration
 * ends up half-applied, and a half-applied accessibility constant is worse than
 * either version alone: a reader cannot tell which one a given file is
 * asserting. `kit-contract.test.ts` fails if a second definition returns.
 */

/**
 * Reference height of the iOS home-indicator / Android gesture-navigation
 * bottom zone (~34pt on notched iPhones). Documentation/QA reference value:
 * runtime code should prefer the real safe-area inset reported by
 * `react-native-safe-area-context` over this static estimate.
 */
export const HomeIndicatorInset = 34;
