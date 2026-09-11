/**
 * Responsive hooks the campaign still has to wire to a real consumer.
 *
 * Emptying this list is a campaign-024 exit criterion (`design-language-v2`
 * R8): the screen wave wires the library grid to `useGridColumns` and the
 * chart surfaces to `useClampedContentWidth`. Keeping the list here rather than
 * deleting the assertion means the requirement cannot quietly disappear.
 */
export const PENDING_RESPONSIVE_CONSUMERS: readonly string[] = [
  // `useGridColumns` is consumed by the Games library; `useClampedContentWidth`
  // and `useAdaptiveValue` are wired as the remaining screens adopt them.
  'useClampedContentWidth',
  'useAdaptiveValue',
];

/**
 * Every layout hook exported by `@/platform/layout`. A new hook must be added
 * here, which forces the author to decide who consumes it.
 */
export const LAYOUT_HOOKS: readonly string[] = [
  'useLayoutTier',
  'useAdaptiveValue',
  'useScreenGutter',
  'useContentMaxWidth',
  'useGridColumns',
  'useIsCompactWidth',
  'useIsWideWidth',
  'useClampedContentWidth',
  'useWindowWidth',
];
