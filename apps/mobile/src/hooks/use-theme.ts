/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useOptionalSettings } from '@/components/settings/settings-provider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DEFAULT_THEME_ID, resolveThemeMode } from '@/theme/registry';

export function useTheme() {
  const scheme = useColorScheme();
  // The player's persisted theme choice (Profile → System/Light/Dark) drives
  // the palette; only 'system' follows the OS. Consumers rendered without a
  // SettingsProvider (isolated tests, previews) keep the system default.
  const themeId = useOptionalSettings()?.themeId ?? DEFAULT_THEME_ID;
  // `useColorScheme` is declared as non-nullable by the shipped React Native
  // typings, but the native implementation is Flow `?ColorSchemeName` — i.e.
  // `ColorSchemeName | null | undefined` — and really does yield `null` before
  // the system appearance is known. The old `scheme === 'unspecified'` guard
  // only handled the sentinel string, so `null`/`undefined` fell through into
  // `Colors[null]`, making this hook return `undefined` and crashing every
  // consumer that reads `theme.text`. Resolve positively instead: only an
  // explicit `dark` selects the dark palette; everything else is light.
  const theme = resolveThemeMode(themeId, scheme === 'dark' ? 'dark' : 'light');

  // Native system surfaces (keyboard, OS dialogs, native pickers) still
  // follow the OS appearance; the app's own kit and screens are fully driven
  // by the resolved mode above. Forcing native chrome via
  // `Appearance.setColorScheme` is intentionally not done: it would mutate
  // the global `useColorScheme` reading used as the system-follow input, and
  // the JS palette already covers every shipped surface.
  return Colors[theme];
}
