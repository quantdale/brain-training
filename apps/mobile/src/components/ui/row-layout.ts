import { useWindowDimensions } from 'react-native';

export type RowLayout = 'auto' | 'inline' | 'stacked';

/** Essential evidence gets its own line when opposing columns become cramped. */
export function useStackedRow(layout: RowLayout = 'auto'): boolean {
  const { width, fontScale } = useWindowDimensions();
  return layout === 'stacked' ||
    (layout === 'auto' && (width < 360 || fontScale >= 1.5));
}
