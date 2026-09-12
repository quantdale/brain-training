# Brain Training — mobile app

Offline-first Android/iOS brain-training app (42-game catalog, adaptive
scoring/progression, local SQLite persistence). Product and development
governance live in the repository root: `AGENTS.md` and
`docs/PROJECT_CONSTITUTION.md`.

## Structure

- Routes: `apps/mobile/src/app` (Expo Router file-based routing).
- Games: `apps/mobile/src/games/` (each a self-contained module).
- Shared game contract: `apps/mobile/src/sdk/` (import as `@/sdk`).

## Commands

Run from `apps/mobile`:

- Install dependencies: `npm install`
- Start the dev server: `npx expo start`
- Test: `npx jest`
- Typecheck: `npx tsc --noEmit`
- Lint: `npx expo lint`

## Android automation

The emulator-local, host-input-free ADB/uiautomator harness is documented in
`docs/ANDROID_AUTOMATION.md`.
