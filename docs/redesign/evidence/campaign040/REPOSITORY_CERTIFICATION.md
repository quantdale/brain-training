# Campaign 040 repository and release gates

All commands below were run against source checkpoint `0cb7727` unless noted.

| Gate | Result |
| --- | --- |
| `npm test -- --runInBand` in `apps/mobile` | PASS — 557 suites passed, 4 skipped; 6,568 tests passed, 5 skipped; 5 snapshots passed |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npx expo-doctor` | PASS — 21/21 checks |
| `npx expo export --platform web` | PASS — web bundles and 20 static routes exported |
| `node scripts/generate-game-registry.mjs --check` | PASS |
| `npx --yes @fission-ai/openspec@1.6.0 validate --all` | PASS — 26/26 |
| `node scripts/validate-repo-state.mjs` | PASS |
| `node scripts/validate-task-ownership.cjs` | PASS |
| `node scripts/validate-affected.mjs --check-sync` and strict changed-path plan | PASS |
| `node scripts/validate-provenance.mjs --check --base=HEAD^` | PASS |
| provenance self-test | PASS — 5 checks |
| Jest signal self-test | PASS |
| offline boundary | PASS — 973 source files clean |
| secrets boundary | PASS — 2,257 tracked text files scanned |
| workflow hygiene | PASS — 4 files scanned |
| dependency audit | PASS — 5 documented accepted advisories, no unallowlisted moderate+ production finding |
| Android release build/install | PASS — final APK installed on dedicated AVD |
| final light/dark capture matrix | PASS — 22/22 |
| final automated accessibility audit | PASS — 0 violations / 22 surfaces |

The composite `certify-clean-checkout.mjs` was not invoked because this
runtime-enabled checkout intentionally contains the existing native and
dependency trees that its clean-checkout precondition rejects. Its constituent
repository gates, typecheck, lint, web export, Expo Doctor, and full Jest were
run directly; no composite certification verdict is implied.

The full Jest run emits known test-harness act/deprecation warnings and
intentional mocked failure logs while all suites remain green. They are not
silenced or relabelled as product failures.

## External CI

The current `0cb7727` push created four completed GitHub runs, all failing in
the platform before any job step ran (`steps: []`):

- [Repository Integrity run 35286614524](https://github.com/quantdale/brain-training/actions/runs/35286614524)
- [App CI run 35286614646](https://github.com/quantdale/brain-training/actions/runs/35286614646)
- [Android Build Smoke run 35286614609](https://github.com/quantdale/brain-training/actions/runs/35286614609)
- [iOS Build Smoke run 35286614594](https://github.com/quantdale/brain-training/actions/runs/35286614594)

These are classified as external runner/workflow execution failures, not
converted into local product failures or success. No workflow was edited.
