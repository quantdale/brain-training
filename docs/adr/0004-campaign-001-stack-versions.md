# ADR 0004 — Campaign 001 Stack and Android Automation Versions

**Status:** Accepted
**Date:** 2026-08-16

## Context

Campaign 001 precondition: reconfirm current official Expo/React Native and chosen Android automation-tool support at execution time, and record consequential stack/version choices as an ADR. Scaffold was generated with `create-expo-app@4.0.0` (template `default`) into `apps/mobile`.

## Decision

Exact versions as generated/installed (all SDK-57-compatible, confirmed via npm registry on 2026-08-16):

- Expo SDK `~57.0.13` (current `latest` dist-tag), `expo-router ~57.0.13` with `src/app/` directory routing and NativeTabs shell.
- React Native `0.86.2`, React `19.2.3`, TypeScript `~6.0.3` (strict), `@/*` path alias to `src/*`.
- `expo-sqlite ~57.0.1` as the canonical SQLite layer (adds its config plugin automatically).
- Test toolchain: `jest-expo ~57.0.4`, `jest ~29.7.0`, `@testing-library/react-native ^14.0.1`; `better-sqlite3 ^13.0.3` as a dev-only Node SQLite backend so persistence tests run the same SQL outside the device.
- `expo-doctor ^1.20.2` (dev) for CI health checks.
- Reanimated `4.5.1` already present in the template.

Android autonomous automation: **pure ADB + uiautomator** harness under `scripts/android/` (install/launch/reset/input/hierarchy/screenshot/logcat). Maestro was evaluated; it is not installed on the host and a harness with zero additional global installs satisfies Campaign 001 (install/launch/reset/emulator-local input/screenshot/logs without host mouse/keyboard). Maestro remains a documented future option.

Dedicated AVD: `braintraining35` — API 35 x86_64 (aosp_atd or google_apis image per availability), headless boot, one emulator.

Provisional identity (branding still deferred): app name "Brain Training", slug `brain-training`, scheme `braintraining`, android package / ios bundle id `com.braintraining.app`.

## Alternatives considered

- Maestro as the automation layer: rejected for now (global install outside repo, not present on host; ADB/uiautomator covers all required proof points).
- Root-level Expo app instead of `apps/mobile`: rejected — monorepo layout keeps root `scripts/`, `docs/`, `.agent/`, CI separate from app code.
- npm workspaces monorepo: rejected for now — Metro/hoisting complexity without immediate benefit; single app package keeps CI and fresh-agent recovery simple.

## Consequences

- Games implement against the SDK; registry is generated (orchestrator-owned script) to avoid shared-file hotspots.
- CI runs `npm ci` + typecheck + jest + web export inside `apps/mobile`.
- The template's `expo-env.d.ts` / `.expo/types` are generated locally and gitignored; typecheck requires running an expo command first (documented in CI).
- `better-sqlite3` is dev-only and never ships in the app bundle.

## Validation / rollback

- Template typecheck/web-export must pass before wave 1 swarm starts.
- Rollback path: pin to an older SDK (e.g. 56) if SDK 57 proves unstable during the campaign; revisit this ADR via a superseding ADR.
