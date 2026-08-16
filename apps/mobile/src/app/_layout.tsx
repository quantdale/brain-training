/**
 * Root layout — app-level providers + navigation stack.
 *
 * - Initializes SQLite (`initDatabase`) and the generated game registry
 *   (`registerGameDefinitions`) before first render; seeds the versioned
 *   quest/achievement definitions and syncs progression (`initializeProgression`).
 * - Theme + settings providers wrap everything, including the game route.
 *   The selected theme id (profile settings, default 'system') is resolved
 *   against the OS scheme by `RootNavigator` so theme changes apply live.
 * - Navigation structure: `(tabs)` group (Home/Games/Progress/Profile) plus
 *   the `game/[id]` route OUTSIDE the tab navigator (NativeTabs only handles
 *   its declared triggers; the game screen must not live inside the tab
 *   navigator — see docs/RECOVERY_DRILL.md wave-2 convergence note).
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { SettingsProvider, useSettings } from '@/components/settings/settings-provider';
import { createRatingPipeline } from '@/rating';
import { initDatabase } from '@/db';
import { getDb } from '@/db';
import { initializeProgression } from '@/progression';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions, getGameDefinition } from '@/registry/registry';
import { THEME_SETTINGS_KEY, resolveThemeMode } from '@/theme/registry';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initialThemeId, setInitialThemeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Rating pipeline: per-domain XP/rating/currency applied atomically
        // with every completed session. Primary category moves at full
        // weight, secondary domains at half (see src/rating/pipeline.ts).
        await initDatabase({
          rating: createRatingPipeline({
            getDomains: (gameId) => {
              const definition = getGameDefinition(gameId);
              if (!definition) {
                return [];
              }
              return [definition.primaryCategory, ...(definition.secondaryDomains ?? [])];
            },
          }),
        });
        registerGameDefinitions(registry);
        // Seed versioned quest/achievement definitions and sync progression
        // (idempotent; failures must not brick startup — caught below).
        await initializeProgression(getDb(), new Date());
        // Persisted theme selection (profile settings), applied via the
        // SettingsProvider initial value.
        const profile = await getDb().profile.get();
        const theme = profile?.settings?.[THEME_SETTINGS_KEY];
        if (!cancelled && typeof theme === 'string') {
          setInitialThemeId(theme);
        }
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
    <SettingsProvider initialThemeId={initialThemeId}>
      <RootNavigator />
    </SettingsProvider>
  );
}

/**
 * Navigation + theme wiring. Lives under SettingsProvider so the selected
 * theme id re-renders the ThemeProvider value live on change.
 */
function RootNavigator() {
  const colorScheme = useColorScheme();
  const { themeId } = useSettings();
  // 'unspecified' (iOS) and null behave like the light scheme for resolution.
  const mode = resolveThemeMode(themeId, colorScheme === 'dark' ? 'dark' : 'light');

  return (
    <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game-detail/[id]" />
        <Stack.Screen name="results" />
        <Stack.Screen name="progress-detail" />
      </Stack>
    </ThemeProvider>
  );
}
