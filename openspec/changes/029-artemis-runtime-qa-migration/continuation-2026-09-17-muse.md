# Campaign 029 continuation — Muse Spark 1.3 Contributor

This is an append-only evidence record for the owner-directed provider
replacement on 2026-09-17. It does not replace the concurrently active
Campaign 031 control-plane files or any uncommitted Campaign 031 worktree
changes.

## Repository and external checkout

- Brain Training was observed on `main` at `44ba1533f4eb5ebcd795723f801633caee914e17`,
  aligned with `origin/main`, with concurrent Campaign 031 product and control
  plane edits left untouched. No product file was changed for Campaign 029.
- ARTEMIS started at local `07ecb219c111775b2567743cebff83e80e914d7e` and
  ended clean at local `26124b4`; local commits were not pushed to
  `google/artemis`. The route commit is `7328c4b`; the inactive-provider
  prewarm removal is `26124b4`.
- ARTEMIS checks: Ruff and compileall passed; the affected unit suite passed
  `147` tests. No credential value, length, prefix, suffix, or fingerprint was
  printed or stored in this repository.

## Authorized route and direct qualification

- Provider: OpenCode Go.
- Model: `muse-spark-1.3-contributor`.
- Protocol/endpoint: OpenAI Responses API,
  `https://opencode.ai/zen/go/v1/responses`.
- Reasoning: `reasoning.effort=xhigh`.
- Fallback: none.
- Credential readiness: **PASS** through the external ARTEMIS `.env`, without
  exposing the secret.
- Text + XHigh: **PASS** with a bounded authenticated response.
- Image + XHigh: **PASS** using a harmless synthetic Settings-like image; the
  response identified visible UI labels and values.
- Structured tool path: **PASS** using automatic tool selection, exact short
  function arguments, and a stateless continuation carrying the tool result.
  Named/required tool choice was rejected by the provider, so ARTEMIS uses the
  supported automatic-selection form. Tool-name audit found no overlong names.

## Effective routing

Offline effective-configuration audit: **20/20 active roles** route to
`openai_responses` / `muse-spark-1.3-contributor` / `xhigh`, with
`fallback=null`. Violations: **0**. Union Alpha, Gemini, and alternate-model
routes in the active configuration: **0**. The generic adapter preserves the
honest User-Agent and stable per-task `x-opencode-session` header.

## Android and MCP evidence

- Before the reload, `mobile_diagnose` through this Codex session reported
  **READY**, 5/5 required checks, helper v6 reachable, and no active or queued
  task on `emulator-5554` (`braintraining-ui35`). ADB was subsequently
  recovered non-destructively on the same AVD; no wipe was used.
- Settings trace `4340ff06-befd-4af7-9404-527940fa68a9` is **INVALID / NOT
  VALIDATED**. The task reached Settings, opened Battery, and verified the
  visible value; its ledger recorded three Muse calls. However, trace stderr
  also recorded the old startup Gemini connection-pool prewarm. It is not a
  Campaign runtime pass and must not be reused.
- ARTEMIS `26124b4` removes that provider-specific startup prewarm; model
  connections now initialize lazily through the configured router. The current
  Codex session's ARTEMIS MCP subprocess was restarted, after which the MCP
  stdio transport closed and could not be reattached from this session.
  Therefore post-fix live MCP configuration, Settings Flash, Brain Training
  Flash, and Brain Training Pro are **BLOCKED / NOT VALIDATED**.

## Campaign disposition

Campaign 029 remains **ACTIVE / NOT CLOSED**. The exact remaining blocker is a
fresh Codex MCP session/reload that can load the patched ARTEMIS process and
produce Muse-only trace evidence. Union Alpha was not retried, and no
alternate model was used as a fallback after the owner directive; the obsolete
Gemini prewarm observed in the invalidated first trace is the reason that trace
cannot satisfy the security/runtime gate.
