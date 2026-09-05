# Proposal — Campaign 021 Release-Gate Reconvergence

## Decision

The repository declares Campaign 020 terminal/VALIDATED, yet the current-head
`Android Build Smoke` release gate is deterministically red on every push since
`c491c2b`. Durable "terminal/validated" status therefore contradicts executable
CI evidence. This campaign restores truth: repair the gate at root cause without
weakening it, re-prove the whole automated matrix on the final candidate SHA,
and synchronize durable state with observed evidence.

## Starting evidence

- `origin/main` head `e77da39`: Android Build Smoke run `33930455910` fails in
  `Install pinned Android build dependencies` at `yes | sdkmanager --licenses`
  with `yes: standard output: Broken pipe` and exit 1 under `bash -eo pipefail`.
- The failing step is redundant: `android-actions/setup-android@v3` already
  accepts SDK licenses (`accept-android-sdk-licenses` defaults to `true`; the
  last green run `33320890688` shows the action accepting licenses and the same
  pinned install — including NDK r27 — succeeding).
- The failure became visible when Campaign 017 closure (`c491c2b`) removed a
  masking `|| true`; it did not change runner behavior. Every run since fails
  identically. App CI, Repository Integrity, and iOS Build Smoke are green at
  head; the Android gate is the only red required workflow.

## In scope

Root-cause fix of the Android CI setup step (fail-closed preserved), a
static workflow-hygiene guard so the producer-side SIGPIPE / exit-masking
failure class cannot silently return, full local regression wave, Android
runtime non-regression on the dedicated AVD, current-head convergence of all
four repository workflows, durable-state truth repair, and a targeted
whole-codebase audit of release-readiness assumptions.

## Out of scope

Game #43, content/product expansion, signing/store publication, cloud/auth/
AI/monetization, iOS runtime UX, and all constitution-deferred systems.

## Completion definition

021 is complete when the Android clean native release build executes
successfully end-to-end on the final pushed SHA, all four repository workflows
are green (or honestly classified external), the full local validation matrix
passes, durable state identifies exactly what is proven at which SHA, and no
contradiction remains between declared and executable status.
