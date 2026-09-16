# Design — ARTEMIS runtime-QA migration

## Boundary

```
Brain Training repository
  ├─ app, SDK, deterministic tests, semantic observability seams
  ├─ scripts/android: AVD/APK setup and evidence capture only
  └─ scripts/qa/validate-runtime-qa-contract.mjs: offline boundary gate

D:\Tools\artemis (external, ignored by product Git)
  ├─ provider environment and upstream Python toolchain
  ├─ doctor/helper/device lifecycle
  ├─ mobile_run_task Flash/Pro interaction
  └─ task/trace management and runtime evidence
```

ARTEMIS is the only authoritative natural-language/device interaction runtime.
ADB remains an allowed emulator-local transport for setup and diagnostics. The
repository must not recreate gameplay flows in shell or JavaScript.

## Credential boundary

Provider credentials are loaded by ARTEMIS from its external `.env` or an
existing host environment variable. Repository code, `.agent` records, Codex
TOML, CI, task prompts, traces, screenshots, and command summaries contain no
credential material. The migration records only readiness/status and safe
failure classifications.

## MCP boundary

Use the upstream ARTEMIS Codex generator to obtain the server configuration,
then merge only its managed `artemis` MCP block into the user's existing Codex
config. Preserve all unrelated servers/settings. Do not invoke the upstream
all-target installer because it also manages global rules and exceeds this
change's scope. The current Codex process may require a restart before the
new server is available to an already-running session.

## Runtime profiles

- Flash is the short, bounded smoke profile: launch the app, reach the main
  surface, exercise one representative interaction, and inspect the trace.
- Pro is the stateful profile: use a workout/game journey that exercises
  persistence, result/next/resume/checkpoint behavior, and diagnostic state.

Each run has one device owner, a named task, a trace ID, and an explicit final
status. Model unavailability, quota exhaustion, device readiness failure, or
an interrupted task is not a product pass.

## Preserved app contract

The migration does not alter game mechanics or product data. It retains
accessibility labels, stable semantic IDs in `src/sdk/testid.ts`, the
`braintraining://` deep-link scheme, deterministic RNG/fixture hooks, version
metadata, structured logs, and development-only force-win/force-loss/timeout
controls. The offline validator asserts the most important boundary pieces
and the absence of the obsolete driver/lock.

## Evidence and convergence

External ARTEMIS traces stay under `D:\Tools\artemis\traces`. Repository
artifacts contain only safe summaries and generic setup captures. CI runs the
offline contract and does not require an emulator or provider credential.
The orchestrator owns shared docs/scripts/config/state convergence; no parallel
coder packet is needed for this small cross-cutting migration.
