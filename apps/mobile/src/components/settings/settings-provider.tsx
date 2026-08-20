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
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_THEME_ID } from '@/theme/registry';

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
  const [themeId, setThemeId] = useState<string>(initialThemeId);

  const setSetting = useCallback(
    (key: SettingKey, value: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        onSettingsChange?.(next);
        return next;
      });
    },
    [onSettingsChange],
  );

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
