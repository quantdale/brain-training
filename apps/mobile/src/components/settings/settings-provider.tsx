/**
 * Settings store — global sensory toggles (SFX / music / haptics).
 *
 * Deliberately dependency-free for Wave 1: state is in-memory only and resets
 * on app restart. Persistence is NOT wired here per packet 001-a (no SQLite,
 * no AsyncStorage dependency). The persistence packet (001-b) will expose the
 * profile settings JSON; wiring the settings store to it (or to AsyncStorage,
 * once the orchestrator installs it) is a later convergence step.
 *
 * The Game SDK (packet 001-c) owns the audio/haptics service interfaces; this
 * store is the shell-level user preference source those services will read.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_THEME_ID } from '@/theme/registry';

/** Sensory setting keys exposed toggles for. */
export type SettingKey = 'sfx' | 'music' | 'haptics';

export type Settings = Record<SettingKey, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  music: true,
  haptics: true,
};

interface SettingsContextValue {
  settings: Settings;
  /** Set one toggle; other toggles are preserved. */
  setSetting: (key: SettingKey, value: boolean) => void;
  /** Selected theme id (see `src/theme/registry.ts`). */
  themeId: string;
  setThemeId: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({
  children,
  initialThemeId = DEFAULT_THEME_ID,
}: {
  children: ReactNode;
  /** Persisted theme id read from profile settings at startup. */
  initialThemeId?: string;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [themeId, setThemeId] = useState<string>(initialThemeId);

  const setSetting = useCallback((key: SettingKey, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({ settings, setSetting, themeId, setThemeId }),
    [settings, setSetting, themeId],
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
