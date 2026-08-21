# Campaign 009 — Cross-platform / iOS static compatibility audit (W16)

Author: W16 · Scope: static audit of `apps/mobile/src` (+ config/native project state).
**No code was changed by this audit.** All fixes are reported here with exact
file:line and proposed diffs for the parent to apply or route.

## Method & coverage

- Full-tree greps over `apps/mobile/src` (1,113 `.ts`/`.tsx` files, 38 game
  modules) for: `Platform.OS/select`, `Dimensions.get`,
  `useWindowDimensions`, `BackHandler`, `KeyboardAvoidingView`, `Keyboard.`,
  `LayoutAnimation`, `UIManager`, `AppState`, `shadow*/elevation`,
  `PanResponder`/responder handlers, `window.`/`document.`/`navigator.`,
  `toLocale*String`/`Intl.`, `NativeModules`/`requireNativeModule`,
  `expo-*` package imports, emoji/symbol code-point inventory,
  `maxFontSizeMultiplier`/`allowFontScaling`, `onLongPress`.
- Deep reads of shell/nav/theme (`_layout.tsx`, `(tabs)/_layout.tsx`,
  `game/[id].tsx`, `results.tsx`, `storage-unavailable.tsx`),
  design tokens, tab bars (native + web), safe-area handling, sensory engine,
  db adapters, data-portability transport, jest setup, metro config,
  `app.json`, committed `android/` manifest.
- Targeted reads inside representative game screens (attention-odd-one-out,
  memory-running-order, attention-symbol-tracker) for touch/timer/a11y patterns.

**Concurrent-edit caveat:** other workers were actively editing
`apps/mobile/src` during this audit (e.g. `components/a11y.ts` appeared
mid-audit; `error-boundary.tsx`, `game-not-ready.tsx`, `app-tabs.web.tsx`,
`progress-charts.tsx` have same-hour mtimes). Line numbers below are as-of-read
and may shift a few lines after campaign convergence.

## Environment facts the audit rests on

- Expo SDK ~57.0.14, React Native 0.86.2, React 19.2.3, TypeScript ~6.0.3
  (`apps/mobile/package.json`). New Architecture is the SDK 57 default.
- `ios/` is gitignored (`.gitignore:41`) — **no iOS native project exists**;
  iOS builds go through CNG (`expo prebuild`) on macOS/EAS. Everything iOS is
  therefore static inference only.
- `android/` IS committed (prebuild output), including
  `android/app/src/main/AndroidManifest.xml`.
- `app.json`: portrait lock, `userInterfaceStyle: automatic`, scheme
  `braintraining`, `ios.icon = ./assets/expo.icon` (liquid-glass icon format),
  `predictiveBackGestureEnabled: false`, plugins: expo-router,
  expo-splash-screen, expo-sqlite, expo-audio, expo-asset.

---

## (a) Fix-now trivial static risks (reported; parent applies)

### A1. Six unused native dependencies inflate the iOS build surface

Zero direct imports in `apps/mobile/src` for:

| dependency | version | notes |
|---|---|---|
| `@expo/ui` | ~57.0.11 | heaviest: native SwiftUI interop layer |
| `expo-glass-effect` | ~57.0.1 | iOS-only native module |
| `expo-device` | ~57.0.1 | |
| `expo-image` | ~57.0.3 | |
| `expo-web-browser` | ~57.0.2 | |
| `expo-linking` | ~57.0.6 | expo-router may require transitively — verify |

Each Expo native module adds pods/frameworks to the iOS build (compile time,
binary size, privacy-manifest surface). `expo-constants`, `expo-font`,
`expo-status-bar`, `expo-system-ui`, `expo-asset` also show zero direct
imports but are commonly pulled in transitively by `expo`/`expo-router`/
splash-screen plugin — verify before touching those.

**Action (parent, `apps/mobile/package.json`):** remove the six above after a
metro-resolution/`expo-doctor` sanity pass. No `src` change required.

### A2. `BottomTabInset` evaluates to 0 on web — defeats its stated purpose

- `apps/mobile/src/theme/tokens.ts:136`
  `export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;`
- Sole consumer `apps/mobile/src/components/screen-shell.tsx:19` applies it
  **only on web**: `const bottomPadding = Platform.OS === 'web' ? BottomTabInset + Spacing.four : Spacing.four;`
- On web neither `ios` nor `android` matches and there is no `web`/`default`
  key → `undefined` → `?? 0`. So the "bottom inset reserved for the floating
  web tab bar" (comment, tokens.ts:135) is always **0**, and the floating pill
  bar (`app-tabs.web.tsx` styles: `bottom: 8`, `paddingVertical: 8`, ~30px
  content ⇒ ≈54–60px tall) can overlap the last content row on web.

Proposed diff (`theme/tokens.ts:136`):

```ts
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 64, default: 0 }) ?? 0;
```

Severity: Low (web is dev-target only) but it is a real logic bug vs intent.

### A3. Card shadow invisible on Android

`apps/mobile/src/rewards/celebration.tsx:129-132` sets only iOS shadow props
(`shadowColor/shadowOpacity/shadowRadius/shadowOffset`); Android ignores them
without `elevation`.

Proposed diff: add `elevation: 4,` to the same style object (cosmetic parity;
harmless on iOS).

### A4. Android permissions exceed what product code uses

`apps/mobile/android/app/src/main/AndroidManifest.xml`:

- `RECORD_AUDIO` — nothing records audio; `expo-audio` is used exclusively for
  short SFX playback (`sdk/audio-haptics-real.ts:99` `createAudioPlayer`).
- `SYSTEM_ALERT_WINDOW` — nothing in `src` creates overlay windows; unexpected.
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + the declared
  `expo.modules.audio.service.AudioControlsService` media-playback service —
  the app plays sub-second SFX; no foreground media playback exists.

Consequences: heavier Play Store data-safety/permission declarations; on iOS
the mirror-image problem is the expo-audio plugin injecting
`NSMicrophoneUsageDescription` by default (see C4).

**Action (parent):** prefer fixing at the source of truth — expo-audio plugin
config in `app.json` (recording disabled / permission string omitted) — then
regenerate; alternatively trim the committed manifest and keep prebuild config
in sync. Both are parent-owned surfaces.

---

## (b) Watch-list (monitor; fix when evidence or before release)

### B1. OS font scaling vs fixed-size game boards

No `maxFontSizeMultiplier` anywhere in `src`; exactly one
`allowFontScaling={false}` (`games/attention-symbol-tracker/components/cell.tsx:79`).
Android `fontScale` up to 2.0 and iOS Dynamic Type will inflate `ThemedText`
inside fixed-height boards/grids/buttons → clipped/overlapping labels at
accessibility sizes. Recommendation: cap once in the shared component
(`components/themed-text.tsx:27`, e.g. `maxFontSizeMultiplier={1.35}`) and
disable scaling for board glyph `Text`s; give `game-ui/game-button.tsx` a
scale-aware min-height.

### B2. Unicode glyph stimuli depend on system fonts

Tally across `src/games`: `●`(21) `★`(18) `▲`(14) `■`(8) `◆`(6) `✓` `♥` `✚`
`⬣`(U+2B23) `⬟`(U+2B1F) `✶`(U+2736) `✖` plus arrows. Fully covered on iOS;
modern Android covers them via Noto Sans Symbols 2, older devices may render
tofu for the rare code points. Mitigation already in place: every stimulus
pairs color + shape + accessibility label
(`games/attention-symbol-tracker/symbols.ts:26-34`,
`games/memory-running-order/symbols.ts:27-29`), so gameplay and a11y survive
even a tofu; only visual distinctiveness degrades. If field reports show tofu,
bundle a symbol font or switch stimuli to vector icons.

### B3. `unstable` NativeTabs API + platform divergence

`components/app-tabs.tsx:9` imports `expo-router/unstable-native-tabs`.
Expo marks this API unstable; rendering differs between iOS (UITabBar-backed,
liquid-glass styling on iOS 26) and Android (Material 3). `constants/tabs.ts`
documents that native `testID` mapping is best-effort. The `tab-*` QA testID
contract must be re-verified on both platforms after every SDK upgrade.

### B4. Every game renders inside a ScrollView

`app/game/[id].tsx:71` wraps games in `ScreenShell`
(`components/screen-shell.tsx:23` uses a `ScrollView`). Verified: **no**
custom pan/drag responders exist in games (`PanResponder`/
`onMoveShouldSetResponder` appear only inside jest snapshots of Pressable
internals), so there is no gesture conflict today. Residual risks: scroll-
position drift under rapid tapping, and shell chrome (title/category pill)
above each game. A dedicated non-scrolling GameHost is proposed in the
architecture-debt report (item D1).

### B5. Bottom safe-area gap on pushed routes (home-indicator iPhones)

`components/screen-shell.tsx:22` requests safe-area edges `top/left/right`
only; on tab routes the native tab host absorbs the bottom inset, but pushed
routes (`game/[id]`, `results`, `progress-*`, `data-management` — registered
outside the tabs in `app/_layout.tsx:188-199`) get only `paddingBottom:
Spacing.four` = 24pt, less than the ~34pt home-indicator zone on notched
iPhones. Lowest interactive controls may sit in the gesture zone.
Candidate fix: add `useSafeAreaInsets().bottom` on non-tab routes. Needs
device verification (also listed in C6).

### B6. Android hardware back discards an active session

No `BackHandler` usage anywhere in `src` (verified). Back pops the game route
immediately; session state is component-local and rows are written only on
completion, so an in-progress session is silently lost. The consistent
AppState auto-pause present in all game screens (e.g.
`games/attention-odd-one-out/screen.tsx:339-346`) does not fire on route-pop.
Product decision: intercept back with a pause/confirm dialog, or accept the
loss. (`enableOnBackInvokedCallback=false` +
`predictiveBackGestureEnabled=false` already disable predictive-back.)

### B7. `allowBackup="true"` interacts with the wipe feature

Committed manifest enables Android Auto Backup for the SQLite store; a cloud
restore after a user-initiated data wipe (`src/data-portability/wipe.ts`)
could resurrect wiped data. Decide policy via `dataExtractionRules`
(exclude the DB) or accept documented behavior.

### B8. Locale-dependent date rendering (informational)

`toLocaleDateString()` with no args: `app/results.tsx:99,153`,
`app/progress-detail.tsx:124,149,193`, `app/game-detail/[id].tsx:286,290`.
Output format varies by device locale/platform — acceptable for UI, but tests
must never assert exact rendered date strings. Contrast:
`analytics/format.ts` deliberately formats UTC explicitly for deterministic
tests — keep that split.

### B9. Route param typing on web deep links (informational)

`app/game/[id].tsx:49` types `useLocalSearchParams<{ id: string }>()`, but web
repeated query keys yield `string[]`. The existing runtime guard
(`getGameDefinition(id ?? "")` → NotReady) makes this safe; preserve the guard
pattern in new routes.

---

## (c) Needs real macOS validation (cannot be cleared statically)

- **C1. First-ever iOS build.** No `ios/` dir (gitignored) → CNG prebuild,
  `pod install`, Xcode build all unvalidated. Specific risks:
  `assets/expo.icon` liquid-glass icon processing; RN 0.86.2 + Reanimated
  4.5.1 (new-arch/Metal) + worklets 0.10.1 pod integration; screens 4.26
  NativeTabs host.
- **C2. New Architecture defaults.** SDK 57 ships newArchEnabled. Mitigating
  fact found by this audit: `src` has **zero** direct `react-native-reanimated`
  / `react-native-gesture-handler` imports (only `rewards/celebration.tsx`
  uses core `Animated`), so the custom-animation surface is tiny. Validate
  celebration animation, NativeTabs, and expo-audio players on simulator.
- **C3. iPad policy.** `app.json` sets no `ios.supportsTablet` (Expo default
  true) with portrait lock. Verify layouts on iPad (`MaxContentWidth` 800
  centering helps) and set `supportsTablet`/`requireFullScreen` explicitly
  before TestFlight.
- **C4. Info.plist privacy strings.** Confirm whether the expo-audio plugin
  injects `NSMicrophoneUsageDescription` during prebuild even though the app
  never records; align with A4 before App Store submission.
- **C5. Status bar appearance.** No `expo-status-bar` usage anywhere; dark
  screens such as `app/storage-unavailable.tsx:53` (`#0b0d12` background)
  rely on the system status-bar style — check contrast in light mode on a
  device; consider explicit StatusBar wiring in `_layout.tsx` (parent-owned).
- **C6. Notched-device insets.** Verify B5 (pushed-route bottom padding) and
  NativeTabs height assumptions on Dynamic Island / home-indicator hardware.

---

## Sound cross-platform patterns found (keep doing these)

- **No dimension assumptions:** zero `Dimensions.get`/`useWindowDimensions`;
  flex layouts + `MaxContentWidth` 800 centering.
- **No DOM leakage:** zero `window.`/`document.`/`navigator.` references in
  native-bundled files.
- **No filesystem-path assumptions:** DB opened by name via
  `openDatabaseSync` (`db/adapters/expo.ts:49-51`); no `path.join`/
  `documentDirectory` in `src`.
- **Correct platform-extension discipline:** `app-tabs.web.tsx` and
  `hooks/use-color-scheme.web.ts` are `.web.tsx`-only;
  `constants/tabs.ts:15` imports `expo-symbols` **type-only** (erased at
  compile).
- **Consistent AppState auto-pause** across all game screens with frozen-clock
  resume semantics (tests assert background time does not advance windows).
- **Pause contract hides challenge on both platforms' a11y stacks:**
  `importantForAccessibility='no-hide-descendants'` **and**
  `accessibilityElementsHidden` set together (e.g.
  `games/attention-odd-one-out/screen.tsx:373-377`); overlay is opaque
  (`components/game-ui/pause-overlay.tsx`).
- **Monotonic injectable Clock** (`sdk/timing.ts:21-26`, prefers
  `performance.now`) keeps scoring off wall-clock jumps.
- **Dependency-free charts** (`components/progress-charts.tsx`) — no SVG-lib
  cross-platform risk.
- **One SQL dialect, two backends:** `db/adapter.ts` abstracts expo-sqlite
  (device) vs better-sqlite3 (Node tests); backend-specific SQL avoided.
- **Sensory engine is fail-open:** every native call in
  `sdk/audio-haptics-real.ts` is fire-and-forget inside try/catch; SFX bundled
  via Metro `require()` (works on both platforms; `.wav` ambient module in
  `declarations.d.ts`).
- **`includeFontPadding: false`** used correctly for Android vertical
  centering parity (`memory-running-order/components/symbol-view.tsx:80`).
- **Fonts degrade gracefully** per platform (`theme/tokens.ts:67-90`): iOS
  system designs, valid Android families, web CSS vars.
- **Metro `.wasm` asset ext** (`metro.config.js`) affects only the web bundle
  (expo-sqlite wa-sqlite backend); native unaffected.

## Deliverable status

- This report: complete, static-analysis only. iOS build/runtime remains
  **NOT VALIDATED by definition** (no macOS host).
- No code changed ⇒ tsc/lint/jest untouched by W16.
