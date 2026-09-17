# Campaign 030B CI and SDK disposition

Date: 2026-09-17

This document separates current local evidence from external service status.
No dependency, Expo configuration, or workflow change was made in Campaign
030B.

## Expo Doctor

Command:

    cd apps/mobile
    npx expo-doctor

Current result: **exit 1; 20/21 checks passed; 1 check failed**. The failed
check is the Expo package-version alignment check, reporting 14 patch-level
mismatches within SDK 57:

| Package | Expected | Found | Classification |
| --- | --- | --- | --- |
| `expo` | `~57.0.23` | `57.0.20` | non-blocking patch drift |
| `expo-asset` | `~57.0.17` | `57.0.16` | non-blocking patch drift |
| `expo-audio` | `~57.0.5` | `57.0.4` | non-blocking patch drift |
| `expo-constants` | `~57.0.18` | `57.0.17` | non-blocking patch drift |
| `expo-document-picker` | `~57.0.2` | `57.0.1` | non-blocking patch drift |
| `expo-file-system` | `~57.0.7` | `57.0.6` | non-blocking patch drift |
| `expo-font` | `~57.0.4` | `57.0.3` | non-blocking patch drift |
| `expo-haptics` | `~57.0.3` | `57.0.2` | non-blocking patch drift |
| `expo-linking` | `~57.0.10` | `57.0.9` | non-blocking patch drift |
| `expo-router` | `~57.0.21` | `57.0.19` | non-blocking patch drift |
| `expo-sharing` | `~57.0.20` | `57.0.18` | non-blocking patch drift |
| `expo-splash-screen` | `~57.0.9` | `57.0.8` | non-blocking patch drift |
| `expo-sqlite` | `~57.0.3` | `57.0.2` | non-blocking patch drift |
| `expo-symbols` | `~57.0.3` | `57.0.2` | non-blocking patch drift |

The new standard AVD installed the debug APK, loaded the current app, exposed
the semantic tree, rendered 22/22 light/dark surfaces, and completed the
representative four-game workout despite this drift. No causal link to the
Campaign 030 ATD black framebuffer or any dynamic-flow issue was established.

Disposition: **`DEFERRED_SEPARATE_MAINTENANCE`**. This is compatibility and
build maintenance debt, not a proven runtime blocker for Campaign 031
readiness. A later maintenance campaign should align the SDK-57 patch set and
revalidate lockfile/native prebuild behavior. Campaign 030B intentionally did
not update packages.

## GitHub Actions zero-step failures

Current push-triggered runs at the synchronized `7f08bf0d92ad15cdee8b4f82900cf919f5932e9a`
all completed as failures before any repository step:

| Workflow | Run | Job | Job conclusion | Runner | Steps |
| --- | ---: | --- | --- | --- | ---: |
| Repository Integrity | [35203346906](https://github.com/quantdale/brain-training/actions/runs/35203346906) | durable-state | failure | none reported | 0 |
| iOS Build Smoke | [35203346939](https://github.com/quantdale/brain-training/actions/runs/35203346939) | iOS Simulator compile smoke | failure | none reported | 0 |
| Android Build Smoke | [35203346887](https://github.com/quantdale/brain-training/actions/runs/35203346887) | Android clean native build | failure | none reported | 0 |
| App CI | [35203346931](https://github.com/quantdale/brain-training/actions/runs/35203346931) | Mobile app build/typecheck/tests | failure | none reported | 0 |

The same four-workflow zero-step pattern was observed at the immediately
preceding documentation SHA `4fa2e3dde7d371485d27262b8cd984f0a369f125`:

| Workflow | Run | Job duration | Steps |
| --- | ---: | ---: | ---: |
| iOS Build Smoke | [35200628275](https://github.com/quantdale/brain-training/actions/runs/35200628275) | about 6 s | 0 |
| Repository Integrity | [35200628174](https://github.com/quantdale/brain-training/actions/runs/35200628174) | about 2 s | 0 |
| App CI | [35200628225](https://github.com/quantdale/brain-training/actions/runs/35200628225) | about 3 s | 0 |
| Android Build Smoke | [35200628200](https://github.com/quantdale/brain-training/actions/runs/35200628200) | about 2 s | 0 |

Additional account-visible checks returned Actions enabled with
`allowed_actions=all`, no SHA-pinning requirement, and zero self-hosted
runners. The API exposed no runner assignment, step log, billing/quota cause,
or service-error detail. A successful historical workflow run proves the
workflow family has run before, but does not identify the current external
failure.

Classification: **`INDETERMINATE_EXTERNAL_PRE_STEP`**. The failure is
consistent with GitHub-side dispatch, account/runner-service, repository
settings, quota, or external-service infrastructure, but the available
metadata cannot distinguish those causes. It is not classified as a
repository workflow defect and no workflow was edited.

Disposition: **accepted separate infrastructure debt** for this readiness
packet. Local workflow hygiene, repository validators, typecheck, lint, tests,
web export, and Android build/install/runtime evidence pass independently; no
current GitHub step output implicates product code or tests. The owner should
re-run after the external condition changes and retain the first run that
creates actual steps.

## Relationship to readiness

Neither Expo patch drift nor the GitHub zero-step pattern is silently ignored.
Both are explicitly isolated, have follow-up dispositions, and are not used
to claim a green remote CI result. They do not block the Campaign 030B visual
and dynamic readiness decision under the campaign's stated decision rules.
