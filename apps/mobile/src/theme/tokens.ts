/**
 * Design tokens — single source of truth for the app shell's visual language.
 *
 * Everything visual in the shell (color, spacing, type, radii) comes from this
 * file. Screens must not hardcode magic colors or sizes; add a token here
 * instead of inventing a one-off value.
 *
 * Palette intent (see docs/PROJECT_CONSTITUTION.md §4):
 * polished/minimal with a playful accent — soft neutral surfaces, one vivid
 * indigo brand accent, semantic colors for feedback.
 */

import { Platform } from 'react-native';

// Web-only: `global.css` defines the `--font-*` CSS variables referenced by
// `Fonts` below. Kept out of the native/test bundles (jest has no CSS
// transform, so a static import would break the test pipeline).
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/global.css');
}

/** Light + dark color palettes. Every scheme exposes the same keys. */
export const Colors = {
  light: {
    // Text & surfaces
    text: '#161A26',
    textSecondary: '#5D6474',
    background: '#F6F7FB',
    /** Legacy surface key kept for template-derived components (ThemedView). */
    backgroundElement: '#ECEEF4',
    /** Legacy surface key kept for template-derived components. */
    backgroundSelected: '#E0E3EC',
    /** Card/sheet surface above the page background. */
    surface: '#FFFFFF',
    /** Hairline borders and dividers. */
    border: '#E3E6EF',
    // Brand & semantics
    /** Primary brand accent (indigo). */
    accent: '#4F6BFF',
    /** Tinted accent fill (chips, selected states, soft emphasis). */
    accentSoft: '#E9ECFF',
    /** Pressed/active variant of the brand accent (tactile button states). */
    accentStrong: '#3B53D9',
    success: '#1E9E62',
    /** Soft success fill for feedback cards and celebration surfaces. */
    successSoft: '#E3F6EC',
    warning: '#D98E04',
    /** Soft warning fill (at-risk/streak nudges, caution cards). */
    warningSoft: '#FBF0DA',
    danger: '#D5485B',
    /** Soft danger fill for error/failure feedback cards. */
    dangerSoft: '#FBE7EB',
    /** Streak flame tone — engagement-streak surfaces only. */
    streak: '#F97316',
    /** Soft streak fill behind the flame and weekly tracker. */
    streakSoft: '#FFF1E4',
    /** XP/level progression tone (distinct from the primary CTA accent). */
    xp: '#7C5CFF',
    /** Soft XP fill for level meters. */
    xpSoft: '#EEE9FF',
    /** Scrim behind completion/celebration overlays. */
    scrim: 'rgba(14, 16, 22, 0.55)',
  },
  dark: {
    text: '#F4F5FA',
    textSecondary: '#9AA1B5',
    background: '#0E1016',
    backgroundElement: '#1B1E28',
    backgroundSelected: '#262B38',
    surface: '#151823',
    border: '#262B38',
    accent: '#8B9BFF',
    accentSoft: '#23284A',
    accentStrong: '#A5B1FF',
    success: '#3BC98B',
    successSoft: '#10281C',
    warning: '#F0B13C',
    warningSoft: '#33260D',
    danger: '#F16B7C',
    dangerSoft: '#3A161F',
    streak: '#FB923C',
    streakSoft: '#3A2312',
    xp: '#A78BFA',
    xpSoft: '#241F43',
    scrim: 'rgba(0, 0, 0, 0.65)',
  },
} as const;

/** Semantic color slot usable by themed components (`ThemedView`, `ThemedText`). */
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii scale. */
export const Radii = {
  small: 8,
  medium: 12,
  large: 20,
  pill: 999,
} as const;

/**
 * Typography scale. `weight` values are valid React Native font weights
 * ('400'..'700'); keep them as string literals so they can be spread into
 * styles without narrowing.
 */
export const Typography = {
  /** Small labels, captions, metadata. */
  caption: { size: 12, lineHeight: 16, weight: '500' as const },
  /** Secondary body text. */
  bodySmall: { size: 14, lineHeight: 20, weight: '500' as const },
  /** Primary body text. */
  body: { size: 16, lineHeight: 24, weight: '500' as const },
  /** Emphasis within body copy. */
  bodyLarge: { size: 18, lineHeight: 26, weight: '500' as const },
  /** Section headers. */
  headline: { size: 22, lineHeight: 30, weight: '600' as const },
  /** Screen titles. */
  title: { size: 28, lineHeight: 36, weight: '600' as const },
  /** Hero/dashboard display. */
  display: { size: 40, lineHeight: 48, weight: '600' as const },
} as const;

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

/**
 * Elevation tokens. RN 0.82 deprecates the `shadow*` style props (their
 * deprecation warning docks LogBox over bottom controls), so cards use
 * `boxShadow` with `elevation` kept as the Android separation guarantee.
 */
export const Elevation = {
  none: { boxShadow: 'none', elevation: 0 },
  /** Default card lift above the page background. */
  card: { boxShadow: '0 2px 10px rgba(20, 24, 44, 0.08)', elevation: 2 },
  /** Raised surfaces: reward/completion cards and primary CTAs. */
  raised: { boxShadow: '0 10px 28px rgba(20, 24, 44, 0.18)', elevation: 6 },
} as const;

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
  /** Bounded celebration period (auto-dismiss). */
  celebration: 650,
} as const;

/** Max content width for tablet/web layouts; screens center within it. */
export const MaxContentWidth = 800;

/** Layout breakpoints consumed by the responsive helpers in `@/platform/layout`. */
export const CompactLayoutMaxWidth = 480;
export const MediumLayoutMaxWidth = 768;

/**
 * Reference height of the iOS home-indicator / Android gesture-navigation
 * bottom zone (~34pt on notched iPhones). Documentation/QA reference value:
 * runtime code should prefer the real safe-area inset reported by
 * `react-native-safe-area-context` over this static estimate.
 */
export const HomeIndicatorInset = 34;
