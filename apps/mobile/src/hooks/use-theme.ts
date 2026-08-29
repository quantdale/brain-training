/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // `useColorScheme` is declared as non-nullable by the shipped React Native
  // typings, but the native implementation is Flow `?ColorSchemeName` — i.e.
  // `ColorSchemeName | null | undefined` — and really does yield `null` before
  // the system appearance is known. The old `scheme === 'unspecified'` guard
  // only handled the sentinel string, so `null`/`undefined` fell through into
  // `Colors[null]`, making this hook return `undefined` and crashing every
  // consumer that reads `theme.text`. Resolve positively instead: only an
  // explicit `dark` selects the dark palette; everything else is light.
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
