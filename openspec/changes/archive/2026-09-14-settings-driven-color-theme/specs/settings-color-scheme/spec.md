## ADDED Requirements

### Requirement: Player theme id drives kit and screen colors
`useTheme()` MUST return the semantic palette for `resolveThemeMode(themeId, osScheme)`. System follows OS appearance. Light and Dark MUST ignore the OS scheme for kit/screen colors.

#### Scenario: Light while OS is dark
- GIVEN Profile theme is Light and the OS color scheme is dark
- WHEN any kit/screen consumer calls `useTheme()`
- THEN it receives the light semantic palette (not `Colors.dark`)

#### Scenario: Dark while OS is light
- GIVEN Profile theme is Dark and the OS color scheme is light
- WHEN `useTheme()` runs
- THEN it receives the dark semantic palette

#### Scenario: System tracks OS
- GIVEN Profile theme is System
- WHEN the OS scheme is dark
- THEN `useTheme()` returns the dark palette

### Requirement: Theme change is immediate and durable
Selecting Light/Dark/System on Profile MUST recolor visible screens without restart. The persisted `themeId` MUST produce the same palette after process relaunch.

#### Scenario: Picker updates live
- GIVEN Profile is showing the theme options
- WHEN the player selects Dark
- THEN Home/Profile chrome using `useTheme()` recolor before restart

#### Scenario: Restart keeps the choice
- GIVEN Dark was persisted
- WHEN the app cold-starts
- THEN `useTheme()` still returns the dark palette regardless of OS scheme
