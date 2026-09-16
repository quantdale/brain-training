# Execution Prompt — Campaign 029: ARTEMIS runtime-QA migration

**Status:** ACTIVE
**Change:** `029-artemis-runtime-qa-migration`
**Planned-From:** `13c0e5d`
**Start-SHA:** `13c0e5d` (activation baseline; migration checkpoint pending)
**Planned-At:** 2026-09-16
**Target-Branch:** `main`
**Predecessor:** `028-production-readiness` (VALIDATED)

## Mission

Execute the owner-supplied migration directive: replace the custom Android
Autobot/device-driving QA with Google ARTEMIS, keep the upstream checkout only
at `D:\Tools\artemis`, make ARTEMIS the Codex Android runtime, remove obsolete
repository driver code/docs/CI, preserve semantic app observability seams, and
leave a secure, buildable, recoverable `main` branch.

## Scope

1. Reconcile ARTEMIS upstream, external environment, doctor/helper/device
   readiness, and safe trace storage.
2. Run the requested system Flash and Brain Training Flash/Pro tasks when the
   provider is usable; classify model/quota/device failures honestly.
3. Generate and merge only the ARTEMIS Codex MCP server block; preserve all
   unrelated user config and do not run `mcp --install all`.
4. Remove `scripts/qa/autobot.mjs`, its lock integration, current invocations,
   and current docs that describe it as authoritative.
5. Keep `scripts/android/` to provisioning, installation/reset, hierarchy,
   screenshot, logcat, and diagnostics; add an offline boundary validator.
6. Update docs, OpenSpec, ownership, governance, state, validation, backlog,
   and known-issue records, then run deterministic gates and an Android build.

## Behavior to preserve

- Product mechanics, scoring, generators, persistence, navigation, and
  constitution-deferred systems are unchanged.
- Stable semantic IDs/accessibility labels, `braintraining://` deep links,
  deterministic seeds/fixtures, versioned metadata, structured diagnostics,
  and safe development-only QA hooks remain available to ARTEMIS.
- No provider credential enters Git, Codex TOML, logs, traces, screenshots,
  task text, or durable state.
- One emulator and one runtime controller remain the default; host input and
  desktop focus are never hijacked.

## Validation

Run the offline runtime-QA contract, repo-state/task-ownership/affected-map
checks, app typecheck/tests/lint, changed-area validators, OpenSpec validation,
and Android build/install diagnostics. Use external ARTEMIS doctor, MCP task
management, and trace inspection for runtime evidence. Never label an
incomplete, quota-blocked, or unrun task as PASS.

## Completion / stop gate

Close only when all repository work is complete, deterministic checks are
green, MCP convergence is verified, current docs/state are truthful, and every
remaining external runtime item is complete or durably classified. If the
same external blocker recurs across goal turns, preserve the work and follow
the platform blocker threshold before marking the goal blocked.

## Git requirements

Commit coherent checkpoints to `main`, push to `origin/main`, never
force-push, and leave no temporary repository worktrees or branches.
