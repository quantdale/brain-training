/**
 * Layout dimension helpers — reactive viewport reads built exclusively on
 * `useWindowDimensions` (campaign009 audit: the codebase has zero static
 * `Dimensions.get` sprawl; keep it that way so rotation/split-screen updates
 * re-render instead of caching stale values).
 *
 * Breakpoints come from `@/theme/tokens` so screens and helpers share one
 * scale. Campaign 024 made this API load-bearing: `useLayoutTier` drives
 * gutters, grid column counts and content width, so tablet/landscape layouts
 * adapt instead of stretching a phone column across the screen.
 */

import { useWindowDimensions } from 'react-native';

import {
  Breakpoints,
  CompactLayoutMaxWidth,
  GridColumns,
  MaxContentWidth,
  MediumLayoutMaxWidth,
  ScreenGutter,
  WideContentWidth,
  type LayoutTier,
} from '@/theme/tokens';

/** Current window width in dp; re-renders on rotation/resize. */
export function useWindowWidth(): number {
  return useWindowDimensions().width;
}

/** True while the window is narrower than the compact breakpoint (phone portrait). */
export function useIsCompactWidth(maxWidth: number = CompactLayoutMaxWidth): boolean {
  return useWindowDimensions().width < maxWidth;
}

/** True when the window fits the medium/tablet band or wider. */
export function useIsWideWidth(minWidth: number = MediumLayoutMaxWidth): boolean {
  return useWindowDimensions().width >= minWidth;
}

/**
 * Window width clamped to the shared max content width — the numeric
 * counterpart of the shell's `MaxContentWidth` centering, for callers that
 * need a measured width (e.g. canvas/chart sizing) rather than a style.
 */
export function useClampedContentWidth(maxWidth: number = MaxContentWidth): number {
  return Math.min(useWindowDimensions().width, maxWidth);
}

/** Current layout tier for the viewport width. */
export function useLayoutTier(): LayoutTier {
  const width = useWindowDimensions().width;
  if (width < Breakpoints.compact) return 'compact';
  if (width < Breakpoints.medium) return 'medium';
  return 'expanded';
}

/** Pick the value matching the current layout tier. */
export function useAdaptiveValue<T>(values: Record<LayoutTier, T>): T {
  return values[useLayoutTier()];
}

/** Horizontal page gutter for the current tier. */
export function useScreenGutter(): number {
  return useAdaptiveValue(ScreenGutter);
}

/** Column count a content grid should use for the current tier. */
export function useGridColumns(): number {
  return useAdaptiveValue(GridColumns);
}

/**
 * Max content width for the current tier: phone-first width on compact/medium,
 * the wider two-column width once there is room for it, but never wider than
 * the measured viewport (web resizes below the cap).
 */
export function useContentMaxWidth(): number {
  const width = useWindowDimensions().width;
  const cap = useLayoutTier() === 'expanded' ? WideContentWidth : MaxContentWidth;
  return Math.min(width, cap);
}
