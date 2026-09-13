## 1. Bind useTheme to settings

- [ ] 1.1 Change `useTheme()` to `resolveThemeMode(themeId, osScheme)` and index `Colors` with that mode; keep null-OS → light.
- [ ] 1.2 Confirm `_layout.tsx` StatusBar/Expo theme still uses the same resolver (no second policy).

## 2. Tests

- [ ] 2.1 Matrix unit test: themeId × OS scheme (system/light/dark × light/dark).
- [ ] 2.2 Profile picker test: select Light under mocked OS dark → consumer sees light `theme.background`.
- [ ] 2.3 Contrast tests still assert AA on both palettes.

## 3. Verification

- [ ] 3.1 `tsc --noEmit` and targeted theme/profile Jest PASS.
- [ ] 3.2 If native chrome still follows OS only, document or apply `Appearance.setColorScheme` as in design.md.
