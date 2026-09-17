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
- The single ARTEMIS-managed target previously reached **READY** as
  `braintraining-ui35` / `emulator-5554` after a non-destructive host-GPU/
  no-snapshot boot. The fresh Codex `mobile_diagnose` check found no attached
  device, no active task, and no competing controller; no AVD was launched in
  this blocked continuation.
- Provider credentials are configured only in the external ARTEMIS `.env` and
  have not been printed or copied into the repository.
- The custom `scripts/qa/autobot.mjs` driver and `.autobot.lock` ignore entry
  are removed. CI, certification, self-test, README, Android, and QA-boundary
  docs now point to ARTEMIS or repository-side setup/evidence tools.
- The offline runtime-QA contract, OpenSpec delta, governance records, and
  historical-document reconciliation are complete and validate cleanly.
- The supported ARTEMIS Codex MCP block is merged with unrelated user MCP
  entries preserved. In this Codex session, `mcp__artemis__mobile_diagnose`
  executed successfully, proving the ARTEMIS MCP tool surface is loaded. The
  block now carries only non-secret paths for the Union Alpha agent override
  and MCP LLM override; a server reload is required before those new values
  affect a task.
- The current Android debug APK built successfully after an emulator-related
  Gradle memory failure was diagnosed, installed successfully, and started
  `MainActivity` on the dedicated AVD. The setup self-test now passes 5 checks
  with 2 documented launcher skips and no host input; no data wipe was used.
- A system Settings Flash attempt reached the Settings app through ARTEMIS but
  did not complete because the old Gemini-backed model service returned
  availability/quota errors. It is **BLOCKED / NOT VALIDATED**, not a pass.
- The owner replaced that path with an explicit provider directive: the only
  authorized remote inference is **OpenCode Go / `union-alpha`** through its
  Anthropic-style Messages endpoint. Gemini, Gemini Robotics, and every other
  model are forbidden for this campaign.
- The external route is prepared and verified offline (no live credential in
  this session): all 20 ARTEMIS runtime roles resolve to
  `anthropic`/`union-alpha` with no fallback (audit PASS), and a small local
  ARTEMIS commit (`e70ca52` on top of upstream `371aa6d`) forwards
  `ANTHROPIC_CUSTOM_HEADERS` so an honest client identity and a stable
  per-task session header survive the SDK's header merge order, and keeps the
  two Google-only lens paths inert when their flags are disabled.
- Live provider work is **BLOCKED / NOT VALIDATED**: `OPENCODE_GO_API_KEY` is
  absent from this session's environment and from the external ARTEMIS `.env`,
  so the fail-closed probe sent no request and ARTEMIS cannot initialize the
  provider. Settings Flash, Brain Training Flash, and Brain Training Pro
  remain unrun on the new route; no other model was substituted. The
  diagnostic also reported an existing Gemini credential in the external
  environment; it was not used and remains unauthorized.

## Remaining work

1. Provide `OPENCODE_GO_API_KEY` (environment only; never Git/config/docs),
   reload the ARTEMIS MCP server so the non-secret route paths take effect,
   alias it for the ARTEMIS process, then run the staged gates in order:
   tiny text probe -> multimodal image probe -> Settings Flash -> Brain
   Training Flash -> Brain Training Pro. Do not substitute another model.
2. No Android target is currently attached according to the fresh diagnostic;
   re-establish the `braintraining-ui35` / single idle target before the
   runtime stages, without adopting a competing session's device.
3. Inspect each ARTEMIS trace and record only what actually completed.

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
missing `OPENCODE_GO_API_KEY` credential keeps the live Flash/Pro items open;
it remains the single documented blocker until a run with that credential
proves them on the `union-alpha` route.
