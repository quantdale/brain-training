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

import { DarkTheme, DefaultTheme, ThemeProvider , Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColorScheme } from "react-native";

import {
  SettingsProvider,
  useSettings,
  type Settings,
} from "@/components/settings/settings-provider";
import { AudioHapticsProvider } from "@/components/sensory/audio-haptics-provider";
import { createRatingPipeline } from "@/rating";
import { initDatabase , getDb } from "@/db";
import { initializeProgression } from "@/progression";
import { registry } from "@/registry/registry.generated";
import {
  registerGameDefinitions,
  getGameDefinition,
} from "@/registry/registry";
import StorageUnavailable from "@/app/storage-unavailable";
import { THEME_SETTINGS_KEY, resolveThemeMode } from "@/theme/registry";

export default function RootLayout() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [initError, setInitError] = useState<Error | null>(null);
  const [initialThemeId, setInitialThemeId] = useState<string | undefined>(
    undefined,
  );
  const [initialAudioSettings, setInitialAudioSettings] = useState<
    Partial<Settings> | undefined
  >(undefined);
  const cancelledRef = useRef(false);

  /**
   * Persist the sensory toggles into the profile settings JSON. Fire-and-forget:
   * a persistence failure must not break the toggle interaction.
   */
  const persistSettings = useCallback((settings: Settings) => {
    try {
      void getDb()
        .profile.update({
          settings: { sfx: settings.sfx, haptics: settings.haptics },
        })
        .catch((error: unknown) => {
          console.error("[startup] failed to persist sensory settings", error);
        });
    } catch (error) {
      console.error("[startup] failed to persist sensory settings", error);
    }
  }, []);

  /**
   * Bootstrap the app. Database initialization is the one storage-critical
   * step: a failure here means the local store cannot be opened, so we surface
   * the recoverable storage-unavailable screen (task 8.4) instead of a
   * silently broken app. Post-init steps (registry registration, progression
   * seeding, profile read) are non-fatal — a failure must not brick startup.
   */
  const bootstrap = useCallback(async () => {
    setStatus("loading");

    // Storage-critical: a failed open/migrate means the canonical local DB is
    // unavailable, so show the recoverable storage-unavailable screen.
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
            return [
              definition.primaryCategory,
              ...(definition.secondaryDomains ?? []),
            ];
          },
        }),
      });
    } catch (error) {
      if (!cancelledRef.current) {
        setInitError(error instanceof Error ? error : new Error(String(error)));
        setStatus("error");
      }
      return;
    }

    // Non-fatal post-init work: registry registration, progression seeding,
    // and the persisted theme read. Any failure is logged but must not brick
    // startup (original design intent).
    try {
      registerGameDefinitions(registry);
      // Seed versioned quest/achievement definitions and sync progression
      // (idempotent).
      await initializeProgression(getDb(), new Date());
      // Persisted theme selection (profile settings), applied via the
      // SettingsProvider initial value.
      const profile = await getDb().profile.get();
      const theme = profile?.settings?.[THEME_SETTINGS_KEY];
      if (!cancelledRef.current && typeof theme === "string") {
        setInitialThemeId(theme);
      }
      const sfx = profile?.settings?.sfx;
      const haptics = profile?.settings?.haptics;
      if (
        !cancelledRef.current &&
        (typeof sfx === "boolean" || typeof haptics === "boolean")
      ) {
        setInitialAudioSettings({
          ...(typeof sfx === "boolean" ? { sfx } : {}),
          ...(typeof haptics === "boolean" ? { haptics } : {}),
        });
      }
    } catch (error) {
      console.error("[startup] post-initialization step failed", error);
    }

    if (!cancelledRef.current) {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    // Initial app bootstrap must set loading/ready/error state on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bootstrap();
    return () => {
      cancelledRef.current = true;
    };
  }, [bootstrap]);

  if (status === "error") {
    return <StorageUnavailable error={initError} onRetry={bootstrap} />;
  }
  if (status === "loading") {
    return null;
  }

  return (
    <SettingsProvider
      initialThemeId={initialThemeId}
      initialSettings={initialAudioSettings}
      onSettingsChange={persistSettings}
    >
      <AudioHapticsProvider>
        <RootNavigator />
      </AudioHapticsProvider>
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
  const mode = resolveThemeMode(
    themeId,
    colorScheme === "dark" ? "dark" : "light",
  );

  return (
    <ThemeProvider value={mode === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game-detail/[id]" />
        <Stack.Screen name="results" />
        <Stack.Screen name="progress-detail" />
        <Stack.Screen name="progress-activity" />
        <Stack.Screen name="progress-domain" />
        <Stack.Screen name="progress-game" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="data-management" />
      </Stack>
    </ThemeProvider>
  );
}
