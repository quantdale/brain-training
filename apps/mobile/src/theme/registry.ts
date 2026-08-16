/**
 * Theme registry seam (campaign 003, constitution §20/§33 boundaries).
 *
 * A small, stable registry of selectable themes plus pure resolution logic.
 * Only the mode is meaningful today (system/light/dark); future cosmetic
 * themes plug in here without touching screens. The selected theme id is
 * persisted in profile settings (`settings.theme`) by the Profile screen;
 * the root layout resolves it against the system scheme at render time.
 */
export interface ThemeOption {
  id: string;
  label: string;
  mode: 'system' | 'light' | 'dark';
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: 'system', label: 'System', mode: 'system' },
  { id: 'light', label: 'Light', mode: 'light' },
  { id: 'dark', label: 'Dark', mode: 'dark' },
] as const satisfies readonly ThemeOption[];

export const DEFAULT_THEME_ID = 'system';

/** Profile settings key holding the selected theme id. */
export const THEME_SETTINGS_KEY = 'theme';

export function getThemeOption(id: string | null | undefined): ThemeOption {
  const match = THEME_OPTIONS.find((option) => option.id === id);
  return match ?? THEME_OPTIONS[0];
}

/**
 * Resolve a theme id to a concrete 'light' | 'dark' mode. 'system' follows
 * the OS scheme (defaulting to light when the scheme is unknown).
 */
export function resolveThemeMode(
  themeId: string | null | undefined,
  systemScheme: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  const mode = getThemeOption(themeId).mode;
  if (mode === 'system') {
    return systemScheme ?? 'light';
  }
  return mode;
}
