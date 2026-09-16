# Android QA repository boundary

Android runtime interaction is delegated to the external Google ARTEMIS
checkout at `D:\Tools\artemis`. ARTEMIS is not cloned, copied, or vendored into
this repository. See [`docs/ARTEMIS_ANDROID_QA.md`](../../docs/ARTEMIS_ANDROID_QA.md)
for setup, Flash/Pro tasks, Codex MCP configuration, credentials, and evidence
rules.

This directory contains only repository-side QA support that remains useful
after the custom device driver was removed:

- `validate-runtime-qa-contract.mjs` — deterministic offline CI contract check;
- `a11y-audit.mjs` — analyzes captured Android hierarchy files;
- `ui-capture.mjs` — optional emulator-local surface capture helper;
- `refero.mjs` — documentation/design research utility.

## Runtime handoff

Use one dedicated emulator and confirm its serial with `adb devices -l`. Start
and diagnose it through ARTEMIS (`mobile_diagnose`, including
`launch_avd="braintraining-ui35"`) and schedule interaction through
`mobile_run_task`. Use Flash for a short smoke and Pro for a stateful workout,
resume, diagnostic, or checkpointed journey. Poll the task with
`mobile_manage_task` and inspect the resulting trace with
`mobile_inspect_trace` before assigning a pass.

The app's semantic IDs, accessibility labels, deep-link scheme, deterministic
seeds, versioned metadata, structured logs, and safe development-only fixture
controls are deliberately preserved. ARTEMIS should use those live semantics;
it should not guess a coordinate path from a stale screenshot.

## Repository gates

The offline contract is intentionally independent of API credentials, network,
Metro, and an emulator:

```bash
node scripts/qa/validate-runtime-qa-contract.mjs
```

The normal repository gates remain the source of truth for deterministic
correctness: Jest, TypeScript, lint, registry/provenance/offline/secrets
validators, and the Android build smoke. Runtime traces are external to Git;
repository-side captures follow [`docs/QA_ARTIFACTS.md`](../../docs/QA_ARTIFACTS.md).

Do not add another gameplay driver here. The generic `scripts/android/` tools
may provision an AVD, install an APK, capture diagnostics, or reset app state,
but ARTEMIS is the only authoritative natural-language/device interaction
runtime.
