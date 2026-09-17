# Campaign 038 runtime validation

## Native runtime

Only the repository-designated disposable Android target was used:

- AVD: `braintraining-ui35`
- serial: `emulator-5554`
- Android 15/API 35
- Metro on port 8081 with emulator-local ADB reverse
- debug APK installed successfully; SHA-256
  `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`

ADB/UIAutomator exercised cold launch, Profile/Games scrolling, immediate
sensory toggles, cold relaunch persistence, theme/display conditions, and
settled controls. `scripts/qa/ui-capture.mjs` captured the matching 22-surface
light/dark matrix. `scripts/qa/a11y-audit.mjs` passed the default, font-scale-2,
and compact matrices. Pillow-based comparison inspected real PNG pixels.

## Repository gates

All commands below passed at the Campaign 038 checkpoint:

- `npm run test:ci -- --no-coverage` — 557 suites passed, 4 skipped; 6,567
  tests passed, 5 skipped; 5 snapshots passed.
- `npm run typecheck`
- `npm run lint`
- `node scripts/validate-repo-state.mjs`
- `node scripts/validate-task-ownership.cjs`
- `npx --yes @fission-ai/openspec@1.6.0 validate --all` — 24/24
- `node scripts/generate-game-registry.mjs --check`
- `node scripts/validate-provenance.mjs --check`
- `node scripts/validate-offline.mjs --check` — 973 source files clean
- `node scripts/validate-secrets.mjs --check`
- `node scripts/validate-workflows.mjs`
- `node scripts/validate-dependency-audit.mjs`
- `node scripts/validate-affected.mjs --check-sync`
- strict affected plan for `_layout.tsx` and the concurrency test
- `node scripts/qa/validate-runtime-qa-contract.mjs`
- `apps/mobile/android/gradlew.bat assembleDebug`

The first focused run of the new concurrency test was intentionally recorded
red against the old code; the same test and the final full suite are green
after the repair.

