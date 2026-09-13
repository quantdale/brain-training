## Context

`SettingsProvider` holds `themeId` (`system` | `light` | `dark`) persisted under `THEME_SETTINGS_KEY`. `resolveThemeMode(themeId, osScheme)` already exists and is used in `_layout.tsx` `RootNavigator` for Expo `ThemeProvider` and `StatusBar`. `useTheme()` in `hooks/use-theme.ts` ignores settings and maps OS `useColorScheme()` to `Colors.light` / `Colors.dark`. Every kit primitive and almost every screen uses `useTheme()`.

## Goals / Non-Goals

**Goals:** one resolution function drives StatusBar, Expo navigation theme, and `Colors.*` consumers.

**Non-Goals:** new tokens, per-game stimulus palettes, forcing native `Appearance` if JS palette is sufficient.

## Decisions

1. **`useTheme` reads settings.** Import `useSettings().themeId` and `useColorScheme()`, return `Colors[resolveThemeMode(themeId, os === 'dark' ? 'dark' : 'light')]`. Keep the existing null-OS → light guard.
2. **Do not fork palettes.** `resolveThemeMode` stays the single policy.
3. **Tests:** render a consumer under SettingsProvider with `themeId: 'light'` and a mocked OS dark scheme; assert light token (e.g. canvas `#FFF8EF` or `theme.background` equality with `Colors.light.background`).
4. **Native widgets:** if RN `useColorScheme` still drives some native chrome, call `Appearance.setColorScheme` when themeId is light/dark and `null` when system — only if a test shows kit colors still mismatch. Prefer JS palette first (smallest change).

## Risks / Trade-offs

- Circular hook imports (settings ↔ theme): keep `resolveThemeMode` in a leaf module (already true if it lives next to settings types).
- Web vs native `useColorScheme` timing: existing null guard stays.

## Testing strategy

- Unit `useTheme` under mocked scheme + themeId matrix (system/light/dark × os light/dark).
- Profile picker test: select Dark → a `theme.background` assertion on a mounted screen.
- Contrast tests remain OS-scheme based or are parameterized by resolved mode; do not weaken AA assertions.
