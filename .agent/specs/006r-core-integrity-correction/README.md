# Campaign 006R — Core Integrity Correction

**Status:** AUTHORITATIVE CORRECTIVE PLAN  
**Baseline audited commit:** `2871e5ab0137b1c6475d21100344280ea9927419`  
**Campaign id:** `006r-core-integrity-correction`  
**Parent:** Campaign 006 — Platform Hardening and Polish  
**Authority:** subordinate to `docs/PROJECT_CONSTITUTION.md`; supersedes Campaign 006 execution until this gate passes

## Why this campaign exists

A deep source-level audit found that the repository has a strong autonomous-development foundation but several cross-subsystem semantic defects are not represented by the current green-test model. The highest-risk problems affect rating difficulty semantics, authoritative XP display, challenge solvability, content ambiguity/versioning, Today's Workout semantics, tutorial persistence, and economy transactionality.

The immediate goal is **not more catalog breadth**. The goal is to make the existing 20-game platform trustworthy enough that additional games do not multiply defective contracts.

Campaign 006 is therefore suspended at its current checkpoint. No new games and no content-count expansion are allowed until Campaign 006R exits successfully. Existing Campaign 006 work may be retained when correct, but it must be reconciled against these specifications.

## Non-goals

This campaign does **not** implement account/auth, Supabase sync, monetization, notifications, widgets, store release, iOS production certification, or a broad visual redesign. It also does not authorize an unrelated full-production hardening campaign. It is a focused integrity correction with the validation depth necessary to prove the repaired contracts.

## Mandatory execution protocol

1. Read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/GOVERNANCE.json`, `.agent/STATE.md`, this file, and the numbered specs before editing code.
2. Execute specs in numeric order unless a spec explicitly says it can run in parallel with another. A later spec may not use an earlier unverified assumption.
3. **P1/High acceptance criteria are hard gates.** Do not proceed past a failed P1 gate.
4. A spec is complete only when every `MUST` criterion and its required validation passes. Do not mark `PASS` because a tool/emulator/service is unavailable; record `NOT VALIDATED` or `BLOCKED`.
5. Do not solve failing tests by disabling them, weakening assertions, adding arbitrary sleeps/retries, or reducing test coverage without a documented causal justification.
6. Preserve historical session rows and raw provenance. Any correction to derived ratings/economy must be explicit and migration-safe; never silently reinterpret old data.
7. Generated files are changed through their generator unless a spec explicitly documents a temporary emergency exception.
8. Shared schema, navigation, registry generators, package manifests, CI, and shared Game SDK/platform seams are orchestrator-owned convergence surfaces.
9. Coder agents may read the whole repo but may only write the surfaces assigned for their packet. Shared-file changes are handed to the orchestrator.
10. Every coherent convergence wave must leave local `main` buildable/typecheck-clean before push. Push to `main` only after the wave's required light validation is green. No routine force-push.
11. Update `.agent/VALIDATION.md` with evidence and `.agent/KNOWN_ISSUES.md` with any accepted non-blocking debt after each spec/wave.
12. Before closing 006R, run Spec 013 in full. Passing unit tests alone is insufficient.

## Severity map and owning spec

| Audit finding | Severity | Owning spec |
|---|---:|---|
| Current `main` App CI/typecheck red | P1 | 001 |
| Difficulty casing makes shared rating/XP fall back incorrectly | P1 | 002 |
| Final adaptive challenge rating not authoritative in persisted difficulty | P1 | 002 |
| Game result UI can display 0 XP while DB awards real XP | P1 | 002 |
| Existing derived ratings may have been computed under defective policy | P1 | 002 |
| Content/generator changes without provenance/version bump | P1 | 003 |
| No machine-enforced content/generator version discipline | P1/P2 | 003 |
| Word Match scored items are semantically ambiguous by construction | P1 | 004 |
| Equation Builder curated/fallback paths can violate solvability for a difficulty | P1 | 005 |
| Tutorial completion defaults to transient in-memory state | P1/P2 | 006 |
| Today's Workout is a list of links, not a persisted 4-game workout flow | P1 product | 007 |
| Workout personalization only reorders an already-selected set | P1/P2 | 007 |
| Reroll count/economics reset on restart and have crash windows | P2 | 007/008 |
| Streak-item purchase can debit without granting | P2 | 008 |
| Quest/achievement claims have claimed-but-unrewarded window | P2 | 008 |
| Currency spending can race below zero | P2 | 008 |
| Ledger/reward identities are not future merge/idempotency safe | P2 | 008/009 |
| Schema lacks several cheap integrity constraints | P2 | 009 |
| Older app can open a newer unsupported DB schema | P2 | 009 |
| Structured DB version columns collapse semver information | P2 | 009 |
| Rating history can record requested rather than actually applied delta | P2 | 010 |
| Rating freshness can use write time instead of evidence time | P2 | 010 |
| Home streak is reconstructed from only 30 sessions | P2 | 010 |
| Results filters only the latest global 50 rating movements | P2/P3 | 010 |
| Overall composite score still missing | P2 product | 010 |
| Lazy game component identity is recreated in route render | P2 | 011 |
| Shared game UI is excessively copied across 20 modules | P2 | 011 |
| Audio/haptics seam is still effectively no-op and sensory prefs transient | P2 | 011 |
| Campaign packet ownership overlaps / writes outside declared surface | P2 process | 012 |
| CI misses several repository-specific semantic gates | P2 process | 012 |
| Passing-test count provides insufficient cross-subsystem confidence | P1 process | 012/013 |
| Catalog contains redundant mechanics requiring review | P2 product | 013 |

## Dependency graph

```text
001 Restore green main
  |
  +--> 002 Rating + authoritative outcomes ---------+
  |                                                  |
  +--> 003 Content/generator provenance ----+        |
  |                                         |        |
  |          +--> 004 Word Match -----------+        |
  |          +--> 005 Equation Builder -----+        |
  |                                                  |
  +--> 006 Tutorial persistence                      |
  |                                                  |
  +--> 007 Workout session/personalization --> 008 Economy transactionality
  |                                                  |
  +---------------------> 009 DB integrity/sync readiness
                                                     |
  002 + 009 ----------------> 010 Rating/progress correctness
                                                     |
  006 + platform ----------------> 011 Game platform convergence
                                                     |
  all implementation specs -------> 012 Swarm/CI semantic gates
                                                     |
  002..012 ------------------------> 013 Full-catalog convergence gate
```

Specs 004 and 005 can run in parallel **after 003's version/provenance contract is agreed**, because they own separate game modules. Other parallelism requires explicit non-overlapping write ownership from the orchestrator.

## Global invariants that all fixes must preserve

- Core gameplay remains offline-first and never waits on network.
- One canonical SQLite local profile remains authoritative locally.
- Completed sessions persist atomically and are never silently rewritten.
- Currency remains ledger-derived, not a mutable balance field.
- Ratings do not decay solely from inactivity; confidence/staleness is separate.
- User-facing difficulty remains Easy/Normal/Hard/Expert/Adaptive while code uses one canonical typed representation.
- Timing-sensitive scoring uses monotonic active time rather than frame count or wall-clock elapsed time.
- Pause obscures the challenge and freezes authoritative game timing.
- A manually abandoned short game does not grant normal progression or rating movement.
- QA-forced controls are unavailable in production builds.
- Content shown to a player must be valid before display: solvable, unambiguous under its game contract, difficulty-compatible, deterministic where seeded, and version/provenance traceable.
- Historical results keep the scoring/generator/content metadata necessary to interpret them after future updates.

## Definition of done for Campaign 006R

All of the following are required:

- Specs 001–012 completed with evidence.
- Spec 013 full-catalog convergence gate passes.
- Real production-shaped session flow proves named + adaptive difficulty reaches the authoritative rating pipeline correctly.
- Per-game result UI displays the authoritative persisted XP/rating outcome, never a disposable no-op value.
- Word Match no longer scores multiple legitimate synonyms as if only one were correct.
- Equation Builder has a final solvability invariant for every emitted puzzle across every named/adaptive configuration tested.
- Content/generator provenance changes require a version/provenance update and are checked automatically.
- Tutorial completion survives remount and app restart and remains replayable.
- Today's Workout is a durable 4-game flow with deterministic selection, completion tracking, and transactional rerolls.
- Purchases/claims/spends are atomic/idempotent and cannot knowingly create a negative balance.
- DB rejects unsupported future schema versions and enforces the agreed cheap invariants.
- Rating history records actual applied movement and evidence timestamps correctly.
- Home streak is correct independent of sessions-per-day density.
- Lazy loading uses stable component identity and shared game-platform primitives reduce cross-game duplication without coupling game mechanics.
- Task ownership is machine-checkable enough to reject overlapping concurrent write packets before launch.
- CI includes the semantic integrity gates established by this campaign.
- Android emulator smoke/convergence evidence covers all 20 games without host mouse/keyboard automation.
- No unresolved Critical/High defect.
- `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, parity docs, and checkpoint reflect repository reality.
- `main` is clean, green, and pushed.

## After this campaign

Create `.agent/checkpoints/006r-core-integrity-correction-complete.md`, restore/rescope Campaign 006 Platform Hardening and Polish, and reassess its remaining accessibility/performance/content work against the new contracts. Do **not** resume raw content-count expansion automatically; only content that satisfies the new versioning and semantic-validity contracts may be added.