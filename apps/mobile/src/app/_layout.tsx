/**
 * Root layout — app-level providers + navigation stack.
 *
 * - Initializes SQLite (`initDatabase`) and the generated game registry
 *   (`registerGameDefinitions`) before first render.
 * - Theme + settings providers wrap everything, including the game route.
 * - Navigation structure: `(tabs)` group (Home/Games/Progress/Profile) plus
 *   the `game/[id]` route OUTSIDE the tab navigator (NativeTabs only handles
 *   its declared triggers; the game screen must not live inside the tab
 *   navigator — see docs/RECOVERY_DRILL.md wave-2 convergence note).
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { SettingsProvider } from '@/components/settings/settings-provider';
import { initDatabase } from '@/db';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        registerGameDefinitions(registry);
      } catch (error) {
        // Never brick startup on an initialization failure: log it and keep
        // rendering. Per-surface errors surface at the point of use.
        console.error('[startup] initialization failed', error);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SettingsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/[id]" />
        </Stack>
      </SettingsProvider>
    </ThemeProvider>
  );
}
