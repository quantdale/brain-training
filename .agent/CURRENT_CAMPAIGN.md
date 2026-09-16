# Campaign 029 — ARTEMIS runtime-QA migration

**Status:** ACTIVE
**Campaign id:** `029-artemis-runtime-qa-migration`
**Predecessor:** `028-production-readiness` (VALIDATED)
**Mode:** day
**Start SHA:** `13c0e5d`
**Change:** `029-artemis-runtime-qa-migration` (ACTIVE)
**Authorization:** owner-supplied migration directive received 2026-09-16.

## Mission

Replace the repository's custom Android Autobot/device-driving QA with Google
ARTEMIS as the external Codex Android runtime. Keep ARTEMIS only at
`D:\Tools\artemis`, preserve the app's semantic observability seams, remove
obsolete repository driver code/docs/CI, install only the supported ARTEMIS
Codex MCP integration, and revalidate the build and deterministic gates.

## Current progress

- External ARTEMIS is reconciled at `D:\Tools\artemis`, upstream revision
  `371aa6d`; its Python environment is synced.
- The single ARTEMIS-managed AVD is `braintraining-ui35`, serial
  `emulator-5554`; ARTEMIS doctor is ready and the bundled accessibility
  helper is installed/enabled. No competing emulator/controller is active.
- Provider credentials are configured only in the external ARTEMIS `.env` and
  have not been printed or copied into the repository.
- The custom `scripts/qa/autobot.mjs` driver and `.autobot.lock` ignore entry
  are removed. CI, certification, self-test, README, Android, and QA-boundary
  docs now point to ARTEMIS or repository-side setup/evidence tools.
- The offline runtime-QA contract, OpenSpec delta, governance records, and
  historical-document reconciliation are complete and validate cleanly.
- The supported ARTEMIS Codex MCP block is merged with unrelated user MCP
  entries preserved; this running Codex process needs a restart/reload before
  in-session ARTEMIS tools can be claimed available.
- The current Android debug APK built successfully after an emulator-related
  Gradle memory failure was diagnosed, installed successfully, and started
  `MainActivity` on the dedicated AVD. A later setup self-test is **NOT
  VALIDATED** because that AVD is currently offline; no data wipe was used.
- A system Settings Flash attempt reached the Settings app through ARTEMIS but
  did not complete because the configured Gemini model service returned
  availability/quota errors. It is **BLOCKED / NOT VALIDATED**, not a pass.
  Brain Training Flash and Pro are not yet validated for the same external
  provider condition.

## Remaining work

1. Keep the two live runtime items open as **BLOCKED / NOT VALIDATED** until
   the external Gemini availability/quota condition changes; then run the
   requested Settings/Brain Training Flash and Pro tasks through ARTEMIS and
   inspect their traces.
2. Complete final stale-reference/secret/unrelated-diff review, commit the
   reconciled checkpoint, and push `main`.

## Protected constraints

- No product features, scoring, persistence, or dependency churn.
- No ARTEMIS source, provider credential, or external trace copied into Git.
- No `mcp --install all`, global rules overwrite, host input, desktop focus
  hijack, multiple emulator, competing controller, blind retry, or fake green.
- Preserve stable semantic IDs/accessibility, deep links, deterministic
  fixtures/seeds, versioned metadata, structured logs, and safe dev-only QA
  controls.

## Exit criteria

The campaign closes after repository migration and deterministic validation are
complete, MCP is safely merged, the app build/install is healthy, and each
live runtime task is either completed or durably classified. The current
external Gemini availability/quota issue keeps the live Flash/Pro items open;
it remains the single documented blocker until a future run proves them.
