# Audit map — settings-driven-color-theme

| Item | Evidence |
|---|---|
| Palette ignores themeId | `apps/mobile/src/hooks/use-theme.ts` uses `useColorScheme()` only |
| Resolver exists but unused by kit | `app/_layout.tsx` `resolveThemeMode(themeId, …)` for StatusBar/Expo ThemeProvider only |
| Picker persists | `app/(tabs)/profile.tsx` `onSelectTheme` writes `THEME_SETTINGS_KEY` |
