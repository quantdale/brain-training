/**
 * Layout dimension helpers — reactive viewport reads built exclusively on
 * `useWindowDimensions` (campaign009 audit: the codebase has zero static
 * `Dimensions.get` sprawl; keep it that way so rotation/split-screen updates
 * re-render instead of caching stale values).
 *
 * Breakpoints come from `@/theme/tokens` so screens and helpers share one
 * scale.
 */

import { useWindowDimensions } from 'react-native';

import { CompactLayoutMaxWidth, MaxContentWidth, MediumLayoutMaxWidth } from '@/theme/tokens';

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
