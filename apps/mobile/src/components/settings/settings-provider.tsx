/**
 * Settings store — global sensory toggles (SFX / haptics).
 *
 * This provider owns the in-memory UI state for the sensory settings and, when
 * wired, persists them into the profile settings JSON (`db/profile`). The
 * production `AudioHapticsProvider` reads these flags and keeps the real engine
 * in sync; persistence is supplied by the root layout via `onSettingsChange`.
 *
 * Background music (`music`) is intentionally excluded: BGM is deferred
 * (constitution §20 / DEFERRED_DECISIONS.md), so exposing a music toggle would
 * be a non-functional control. The engine still supports `musicEnabled` for
 * when BGM is implemented.
 *
 * The Game SDK (`@/sdk/audio-haptics*`) owns the service interfaces and the
 * real implementation; this store is the shell-level user preference source.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_THEME_ID, getThemeOption, THEME_SETTINGS_KEY } from '@/theme/registry';
import {
  completePreferenceHydration,
  preferenceChangesBlocked,
  requirePreferenceHydration,
  withAuthoritativePreferences,
} from './profile-preferences';

/** Sensory setting keys exposed as toggles. */
export type SettingKey = 'sfx' | 'haptics';

export type Settings = Record<SettingKey, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  haptics: true,
};

export interface SettingsContextValue {
  settings: Settings;
  /** Set one toggle; other toggles are preserved. */
  setSetting: (key: SettingKey, value: boolean) => void;
  /** Selected theme id (see `src/theme/registry.ts`). */
  themeId: string;
  setThemeId: (id: string) => void;
  /** Replace from canonical profile settings without persisting a new intent. */
  hydratePreferences: (profileSettings: Record<string, unknown>) => void;
  /** Read failure is separate from mutation success; writes remain blocked. */
  preferenceHydrationError: string | null;
  preferenceHydrationBusy: boolean;
  reconcilePreferences: (read: () => Promise<Record<string, unknown>>) => Promise<void>;
  /** Retry only the saved canonical read, never the import/wipe mutation. */
  retryPreferenceHydration: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({
  children,
  initialThemeId = DEFAULT_THEME_ID,
  initialSettings,
  onSettingsChange,
}: {
  children: ReactNode;
  /** Persisted theme id read from profile settings at startup. */
  initialThemeId?: string;
  /** Persisted sensory settings read from profile settings at startup. */
  initialSettings?: Partial<Settings>;
  /** Called whenever a sensory toggle changes, for persistence. */
  onSettingsChange?: (settings: Settings) => void | Promise<void>;
}) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [themeId, updateThemeId] = useState<string>(initialThemeId);
  // Latest committed settings, so two synchronous toggles compose correctly
  // without reading state inside a setState updater. Persistence is a side
  // effect: React may replay/discard an updater, so a discarded concurrent
  // render must never double-persist. `settings` only changes through
  // `setSetting` or authoritative hydration, which update this ref together.
  const settingsRef = useRef(settings);
  const [preferenceHydrationError, setPreferenceHydrationError] = useState<string | null>(null);
  const [preferenceHydrationBusy, setPreferenceHydrationBusy] = useState(false);
  const hydrationReadRef = useRef<(() => Promise<Record<string, unknown>>) | null>(null);
  const hydrationInFlightRef = useRef(false);

  const setSetting = useCallback(
    (key: SettingKey, value: boolean) => {
      if (preferenceChangesBlocked()) return;
      const next = { ...settingsRef.current, [key]: value };
      settingsRef.current = next;
      setSettings(next);
      onSettingsChange?.(next);
    },
    [onSettingsChange],
  );

  const setThemeId = useCallback((id: string) => {
    if (!preferenceChangesBlocked()) updateThemeId(id);
  }, []);

  const hydratePreferences = useCallback((profileSettings: Record<string, unknown>) => {
    const next = {
      sfx: typeof profileSettings.sfx === 'boolean' ? profileSettings.sfx : DEFAULT_SETTINGS.sfx,
      haptics: typeof profileSettings.haptics === 'boolean' ? profileSettings.haptics : DEFAULT_SETTINGS.haptics,
    };
    settingsRef.current = next;
    setSettings(next);
    const theme = profileSettings[THEME_SETTINGS_KEY];
    updateThemeId(getThemeOption(typeof theme === 'string' ? theme : DEFAULT_THEME_ID).id);
    completePreferenceHydration();
  }, []);

  const reconcilePreferences = useCallback(async (read: () => Promise<Record<string, unknown>>) => {
    hydrationReadRef.current = read;
    requirePreferenceHydration();
    hydrationInFlightRef.current = true;
    setPreferenceHydrationBusy(true);
    try {
      hydratePreferences(await read());
      hydrationReadRef.current = null;
      setPreferenceHydrationError(null);
    } catch (error) {
      // Do not relabel a committed import/wipe as failed. The provider owns
      // recovery so navigating away cannot drop the write lock or retry read.
      setPreferenceHydrationError(error instanceof Error ? error.message : String(error));
    } finally {
      hydrationInFlightRef.current = false;
      setPreferenceHydrationBusy(false);
    }
  }, [hydratePreferences]);

  const retryPreferenceHydration = useCallback(async () => {
    const read = hydrationReadRef.current;
    if (!read || hydrationInFlightRef.current) return;
    // Reserve synchronously to reject rapid retries before the queued read starts.
    hydrationInFlightRef.current = true;
    await withAuthoritativePreferences(() => reconcilePreferences(read));
  }, [reconcilePreferences]);

  const value = useMemo(
    () => ({ settings, setSetting, themeId, setThemeId, hydratePreferences,
      preferenceHydrationError, preferenceHydrationBusy, reconcilePreferences, retryPreferenceHydration }),
    [settings, setSetting, themeId, setThemeId, hydratePreferences,
      preferenceHydrationError, preferenceHydrationBusy, reconcilePreferences, retryPreferenceHydration],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Read the current settings and a setter. Must be used under `SettingsProvider`. */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * Context read that tolerates a missing provider: returns `undefined` instead
 * of throwing. Used by `useTheme`, which many kit primitives and isolated unit
 * tests render without the full provider stack; those fall back to the system
 * theme, matching the pre-settings behavior.
 */
export function useOptionalSettings(): SettingsContextValue | undefined {
  return useContext(SettingsContext);
}
