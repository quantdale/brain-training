# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-17 (deep audit completed; Campaign 006R corrective gate staged)  
**Canonical branch:** `main`  
**Active campaign:** `006r-core-integrity-correction`

## Current status

**Campaign 005 (Catalog Depth and UX Polish, Phase 5) is COMPLETED.** The repository reached a 20-game catalog and previously demonstrated strong autonomous development, SQLite persistence, Android AVD automation, rating/progression foundations, quests, streaks, Today's Workout selection, and platform QA infrastructure.

**Campaign 006 (Platform Hardening and Polish) STARTED but is now SUSPENDED.** The audited checkpoint `2871e5ab0137b1c6475d21100344280ea9927419` (`ongoing campaign 6`) introduced useful work but App CI/typecheck was red and a deep source-level audit found cross-subsystem semantic defects that must be corrected before more catalog/content expansion.

The owner explicitly requested a very detailed repository-persisted corrective master plan that autonomous agents can execute. That plan is now the source of truth:

`.agent/specs/006r-core-integrity-correction/README.md`

and numbered specs `001` through `013` in the same directory.

## Why 006R blocks further breadth

The audit found important defects/risks including:

- canonical lowercase difficulty values mismatching capitalized shared rating/XP lookup keys;
- final adaptive challenge not consistently authoritative in persisted difficulty;
- game result UI able to show no-op `0 XP` while DB awards real XP;
- Word Match content allowing several legitimate synonyms but scoring only one arbitrary option;
- Equation Builder curated/fallback paths not proving solvability under every active operator/difficulty rule;
- content/generator candidate pools changing without enforceable provenance/version bumps;
- tutorial completion defaulting to transient in-memory lifecycle state;
- Today's Workout being four independent links rather than a durable four-game session flow;
- personalization reordering an already-selected set instead of selecting from the full eligible catalog;
- reroll/purchase/claim operations with durability/atomicity/idempotency gaps;
- DB integrity/version-compatibility gaps;
- streak/history queries whose arbitrary limits can produce incorrect player-visible values;
- task packet ownership overlaps and insufficient semantic CI gates.

These are documented in detail in the 006R specs. Do not rely on this summary as the implementation specification.

## Completed campaign 005

- `4434d33` — four additional games + registry (Memory/Speed/Math/Language expansion)
- `d13dd59` — Campaign 005 completion checkpoint/state/parity update; Campaign 006 staged
- 20 registered games at the completion boundary
- prior convergence evidence: TypeScript clean, 177 suites / 2097 tests green before Campaign 006 work

Checkpoint: `.agent/checkpoints/005-catalog-depth-and-ux-polish-complete.md`.

## Completed campaign 004

- `90a2da9` wave1: odd-one-out, tap-rush, sequence-memory, missing-operator + registry
- `69fc2f5` wave2: word-scramble, code-cracker, color-stroop, transform-match + registry
- `48efbd0` completion checkpoint/state/parity update

## Completed campaign 003

- `c2680a2` wave1: DB schema v3 + progression repositories
- `d46a46d` task packets
- `8d7dbe6` swarm deliverables
- `4b3b4c4` convergence
- `bcde66a` completion gate/checkpoint

Campaign 003 proved the autonomous/platform gate but several semantics from later expansion now require the 006R correction.

## Next required action

Execute **Spec 001 only**:

`.agent/specs/006r-core-integrity-correction/001-restore-green-main.md`

Restore a verified green local baseline from canonical `main`, fix current TypeScript/CI break without suppression shortcuts, freeze breadth/content-count expansion, record validation evidence, commit/push the coherent repair, and verify CI when available.

After Spec 001 passes, continue numerically according to `.agent/CURRENT_CAMPAIGN.md` and the 006R master spec.

## Important invariants

- Android-first autonomous QA; one dedicated AVD by default.
- No host physical mouse/keyboard automation.
- Up to 7 coder agents only with explicit disjoint write ownership.
- Shared DB/navigation/registry/Game SDK/CI/package/durable-state files are orchestrator convergence surfaces.
- No autonomous full hardening unrelated to this owner-authorized corrective gate.
- No autonomous force-push to `main`.
- GitHub `main` is canonical.
- No new game modules or raw content-count expansion until 006R exit gate passes.
- Historical completed sessions are evidence and must not be silently rewritten/deleted.
- Unavailable validation is `NOT VALIDATED`/`BLOCKED`, never PASS.

## Recovery note

A fresh agent should read, in order:

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/specs/006r-core-integrity-correction/README.md`
7. the current numbered 006R spec
8. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant ADRs, and recent Git history

Do not require chat history to recover the correction campaign.