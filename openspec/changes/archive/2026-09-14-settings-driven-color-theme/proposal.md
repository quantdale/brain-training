# Proposal — Settings-driven color theme

## Why

Profile exposes System / Light / Dark and persists `themeId`, and the root navigator already resolves `resolveThemeMode(themeId, osScheme)` for Expo Router `ThemeProvider` and `StatusBar`. Every kit and screen color goes through `useTheme()`, which reads only React Native `useColorScheme()`. Choosing Light while the OS is Dark (or the reverse) does not recolor the app. The picker is a lie.

## What Changes

- `useTheme()` MUST return the palette for the **resolved** player theme (`themeId` + OS scheme via existing `resolveThemeMode`), not the raw OS scheme alone.
- Profile Light/Dark MUST recolor screens and kit primitives immediately and after restart (persistence already exists).
- System MUST continue to follow OS appearance.
- Tests MUST fail if `useTheme` ignores `themeId`.

## Capabilities

### New Capabilities

- `settings-color-scheme`: player theme id drives the semantic color palette used by screens and UI kit.

### Modified Capabilities

- (none in main `openspec/specs/`)

## Impact

- `apps/mobile/src/hooks/use-theme.ts`
- `apps/mobile/src/hooks/use-settings.ts` / SettingsProvider
- Possibly `Appearance.setColorScheme` if native widgets must match
- `apps/mobile/src/app/_layout.tsx` (already resolves mode for StatusBar)
- `apps/mobile/src/app/(tabs)/profile.tsx` theme picker
- Theme/contrast tests

## Out of scope

- New palettes or Campaign 026 identity redesign
- Per-game stimulus palettes (documented exception)
- Tablet-specific UX

## Evidence

- `use-theme.ts` uses `useColorScheme()` only; comment discusses null OS scheme, not `themeId`.
- `_layout.tsx` `RootNavigator` computes `mode = resolveThemeMode(themeId, …)` for `ThemeProvider`/`StatusBar` only.
- Profile `onSelectTheme` persists `THEME_SETTINGS_KEY` and toasts persist failure (028) — in-session colors still ignore the id.

## Dependencies

None.

## Intended outcome

Light, Dark, and System on Profile produce the matching semantic palette across Home, Games, Progress, Profile, game chrome, and kit primitives.
