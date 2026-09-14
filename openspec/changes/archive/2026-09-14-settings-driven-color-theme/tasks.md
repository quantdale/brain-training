## 1. Bind useTheme to settings

- [x] 1.1 Change `useTheme()` to `resolveThemeMode(themeId, osScheme)` and index `Colors` with that mode; keep null-OS → light.
- [x] 1.2 Confirm `_layout.tsx` StatusBar/Expo theme still uses the same resolver (no second policy).

## 2. Tests

- [x] 2.1 Matrix unit test: themeId × OS scheme (system/light/dark × light/dark).
- [x] 2.2 Profile picker test: select Light under mocked OS dark → consumer sees light `theme.background`.
- [x] 2.3 Contrast tests still assert AA on both palettes.

## 3. Verification

- [x] 3.1 `tsc --noEmit` and targeted theme/profile Jest PASS.
- [x] 3.2 If native chrome still follows OS only, document or apply `Appearance.setColorScheme` as in design.md.
