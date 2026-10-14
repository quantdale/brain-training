import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { Spacing } from '@/constants/theme';

/** Static color pegs can shrink; the interactive palette keeps its touch floor. */
export function useCodePegSize(codeLength: number) {
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (Number.isFinite(width) && width > 0) setAvailableWidth(width);
  }, []);
  const fittedSize = availableWidth === null
    ? 44
    : (availableWidth - Spacing.two * Math.max(0, codeLength - 1)) / Math.max(1, codeLength);
  return { pegSize: Math.max(24, Math.min(44, fittedSize)), onLayout };
}
