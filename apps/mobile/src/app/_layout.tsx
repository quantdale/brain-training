/**
 * Root layout — theme provider + tab shell + app-level providers.
 *
 * The template's animated Expo splash overlay is removed: expo-splash-screen
 * now auto-hides when the app is ready (native splash config lives in
 * app.json, which the orchestrator owns).
 *
 * Startup wiring (orchestrator convergence):
 * - `initDatabase()` opens/migrates SQLite and ensures the local profile.
 * - `registerGameDefinitions(registry)` validates and loads the generated
 *   game catalog from `src/registry/registry.generated.ts`.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { initDatabase } from '@/db';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';

export default function TabLayout() {
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
        <AppTabs />
      </SettingsProvider>
    </ThemeProvider>
  );
}
