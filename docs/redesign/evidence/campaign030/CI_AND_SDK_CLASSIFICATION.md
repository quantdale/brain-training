# Campaign 030 CI and SDK Classification

Date: 2026-09-17

Product baseline: 5c484a08083963439360cb06c229249029f90531

This document separates local repository evidence from external service
evidence. Neither classification was used as permission to change product
code, dependencies, Expo configuration, or workflows.

## Expo Doctor

Command:

    cd apps/mobile
    npx expo-doctor

The process returned exit code 0 in this shell, but its report was a failure:
20/21 checks passed and one check failed. The failure was the Expo package
patch-drift check. Fourteen package mismatches were reported:

| Package | Expected | Found |
| --- | --- | --- |
| expo | ~57.0.23 | 57.0.20 |
| expo-asset | ~57.0.17 | 57.0.16 |
| expo-audio | ~57.0.5 | 57.0.4 |
| expo-constants | ~57.0.18 | 57.0.17 |
| expo-document-picker | ~57.0.2 | 57.0.1 |
| expo-file-system | ~57.0.7 | 57.0.6 |
| expo-font | ~57.0.4 | 57.0.3 |
| expo-haptics | ~57.0.3 | 57.0.2 |
| expo-linking | ~57.0.10 | 57.0.9 |
| expo-router | ~57.0.21 | 57.0.19 |
| expo-sharing | ~57.0.20 | 57.0.18 |
| expo-splash-screen | ~57.0.9 | 57.0.8 |
| expo-sqlite | ~57.0.3 | 57.0.2 |
| expo-symbols | ~57.0.3 | 57.0.2 |

### Drift classification

| Question | Classification |
| --- | --- |
| Is this patch drift? | [Verified by command] Yes. All reported mismatches are patch-level within the Expo SDK 57 line. |
| Did the drift cause the Campaign 030 AVD graphics failure? | [Inferred] Not established. The app loaded its JS routes and populated native trees despite the drift; the dedicated AVD simultaneously reported HWUI drawing disabled and zero rendered frames. |
| Did the drift cause the Campaign 029 ADB/runtime incidents? | [Inferred] Not established. No causal reproduction was obtained, and the current app can boot/install/route-load on the dedicated target. |
| Is the drift harmless forever? | [Inferred] No. It is a real maintenance issue that may affect native build/prebuild compatibility and should be resolved or explicitly accepted. |
| Should it be changed in Campaign 030? | [Verified in campaign scope] No. Dependency and native prebuild changes are outside the authorized evidence packet. |
| Recommended sequencing | [Inferred] First establish a framebuffer-capable runtime and complete the golden path. Then run a separate Expo patch-alignment maintenance campaign, including lockfile/native prebuild validation, before mixing redesign implementation with dependency churn. |

The drift is a maintenance prerequisite or separate risk, not a proven
explanation for the blank screenshots.

## GitHub Actions zero-step failures

The repository has four active workflows. At the current documentation HEAD
88d13938b3e32e95018e79135aabd97f55fb37de, all four push-triggered runs failed
within seconds and each created exactly one completed job with zero steps:

| Workflow | Run | Job | Status | Steps |
| --- | ---: | --- | --- | ---: |
| App CI | 35187297387 | Mobile app build/typecheck/tests | completed / failure | 0 |
| Android Build Smoke | 35187297329 | Android clean native build | completed / failure | 0 |
| Repository Integrity | 35187297300 | durable-state | completed / failure | 0 |
| iOS Build Smoke | 35187297272 | iOS Simulator compile smoke | completed / failure | 0 |

Run links:

- https://github.com/quantdale/brain-training/actions/runs/35187297387
- https://github.com/quantdale/brain-training/actions/runs/35187297329
- https://github.com/quantdale/brain-training/actions/runs/35187297300
- https://github.com/quantdale/brain-training/actions/runs/35187297272

Supporting observations:

- [Verified by command] GitHub Actions repository permissions were enabled
  with allowed_actions=all and no SHA-pinning requirement.
- [Verified by command] The repository exposes zero self-hosted runners.
- [Verified by command] GitHub check suites showed the four failed
  github-actions suites with one check each; unrelated queued suites from
  other installed apps were not treated as workflow results.
- [Verified by command] App CI had successful historical runs, including run
  33981809528 on 2026-09-05 at SHA 22bf196, while the current run and several
  immediately preceding Campaign 029 documentation SHAs failed.
- [Verified by command] Local workflow hygiene passed and the same workflow
  files parse/validate in the repository’s local checks.
- [Verified by command] Branch-protection inspection returned GitHub’s plan
  limitation: upgrading to GitHub Pro or making the repository public is
  required to enable that feature. This is recorded as account/plan context,
  not as a cause of the zero-step jobs.

### CI classification

The strongest evidence-supported classification is:

    BLOCKED / INDETERMINATE — GitHub-side, account/dispatch, runner-service,
    or repository-settings failure before step execution

The zero-step pattern across App CI, Android, repository integrity, and iOS is
not consistent with an ordinary test assertion or compile failure. A precise
root cause cannot be established from the available run metadata because no
step log exists. The successful historical runs show that the workflow family
has run before, but do not identify what changed in the current GitHub
environment.

This is not classified as a repository workflow defect, and no workflow was
edited. The repository owner should next inspect Actions settings, billing/
plan restrictions, service incidents, policy/organization controls, and the
run/job details in the GitHub UI or support channel. Re-run after the external
condition changes and retain the first run with actual step creation.

## Local verification summary

The following checks passed locally at the Campaign 030 baseline:

- TypeScript typecheck
- ESLint
- npm ci dry-run with scripts ignored
- full Jest CI signal and signal-validator self-test
- registry/catalog validation
- provenance, offline, secrets, task ownership, and affected synchronization
- dependency audit under the repository allowlist
- runtime-QA contract
- OpenSpec validation, 16/16
- Expo web export, 20 routes and 47 bundles

The local green result does not override the external zero-step failure or the
native graphics limitation.
