# Tasks — ARTEMIS runtime-QA migration

## 1. External ARTEMIS setup

- [x] 1.1 Clone/reconcile the official ARTEMIS checkout only at
      `D:\Tools\artemis`; keep the product repository free of vendored copies.
- [x] 1.2 Run ARTEMIS `uv sync`, doctor, ADB readiness, and helper installation
      on the single dedicated emulator; record no-secret readiness evidence.
- [x] 1.3 Configure the provider environment externally without printing or
      committing the credential.
- [ ] 1.4 Complete a system Settings Flash smoke task — **INVALID / NOT
      VALIDATED** for the first attempted trace: the UI sequence completed, but
      trace stderr showed the obsolete Gemini startup prewarm. The local
      ARTEMIS fix removes that inactive-provider request path; a fresh Codex
      MCP process must be loaded before rerunning the task. Evidence:
      `docs/campaign029-muse-continuation-2026-09-17.md`.
- [ ] 1.5 Complete Brain Training Flash and Pro tasks on the current APK —
      **BLOCKED / NOT VALIDATED** because the patched MCP stdio transport closed
      before a fresh Muse-only task could start. Do not claim a runtime pass
      until fresh traces prove the Muse route and pass trace inspection.

## 2. Repository boundary migration

- [x] 2.1 Remove `scripts/qa/autobot.mjs` and its repository lock integration.
- [x] 2.2 Replace current CI, certification, Android self-test, README, and
      runtime-QA docs so ARTEMIS is authoritative and Android scripts are
      setup/evidence only.
- [x] 2.3 Add the offline runtime-QA contract validator and assert preserved
      app observability seams.
- [x] 2.4 Complete the durable-state and historical-document reconciliation;
      preserve historical evidence while removing stale current instructions.

## 3. Codex integration and app verification

- [x] 3.1 Generate and merge only the supported ARTEMIS Codex MCP server block;
      verify existing MCP entries remain intact and record restart status.
- [x] 3.2 Build/install the current Android debug app and confirm it starts on
      the dedicated emulator using ADB/diagnostic evidence.
- [x] 3.3 Run typecheck, tests, lint, repository validators, OpenSpec, and the
      Android setup/contract smoke; classify any unavailable checks honestly.
      The offline contract and the device self-test both passed; the self-test
      recorded two documented launcher skips and no failures.

## 4. Convergence

- [x] 4.1 Review `git grep` for current obsolete-driver commands, inspect the
      diff for secrets and unintended product changes, and commit coherent
      progress; all migration checkpoints are pushed to `origin/main`.
- [x] 4.2 Leave a recoverable active checkpoint while the live-provider tasks
      remain durably classified; campaign closure remains deferred until a
      future available-provider run completes or reclassifies those tasks.
