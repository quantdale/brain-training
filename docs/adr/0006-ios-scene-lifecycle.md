# ADR-0006: Adopt the iOS scene life cycle through Expo's build-properties plugin

**Status:** Accepted
**Date:** 2026-11-08

## Context

The first simulator run of the app on iOS terminated about one second after
launch with SIGTRAP. UIKit logged: "UIScene life cycle is required for apps
built with this SDK." Xcode 27.2 links the iOS 27 SDK, and the generated SDK 57
`AppDelegate` creates its own window. CI missed this because iOS Build Smoke
compiles the app and never launches it.

## Decision

Enable `ios.enableSceneSupport` in the `expo-build-properties` config plugin.
Prebuild then replaces the window bootstrap with Expo's `ExpoAppSceneDelegate`
and adds a single-scene `UIApplicationSceneManifest`. The `ios/` directory stays
generated. No hand-written Swift is added.

## Alternatives rejected

- Building with Xcode 26: Apple still accepts the iOS 26 SDK, but this postpones
  the same failure and needs a second Xcode install.
- A custom Swift scene delegate: duplicates code Expo already ships.
- Upgrading to Expo SDK 58 now: its template includes scene support, but it is a
  foundational upgrade unrelated to this crash.

## Consequences

- The option requires `expo` 57.0.23 or newer in SDK 57.
- SDK 58 makes the option a no-op, so remove it during that upgrade.
- Multiple windows stay disabled. Scene adoption does not imply multi-window.
- Cold-start deep links now arrive through scene connection options, which
  `ExpoAppSceneDelegate` converts back into launch options for React Native.
