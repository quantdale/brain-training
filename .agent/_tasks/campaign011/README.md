# Campaign 011 — Full Validation, QA, Audit, Fix & Hardening (worker packets)

**Campaign id:** `011-full-validation-hardening`
**Baseline:** `main` @ `2630a77` (post-010), clean tree, 42 games.
**Mode:** validation-heavy. Target allocation ≈ 40% test/audit · 35% fix · 15% device/integration · 10% convergence/docs.
**Topology:** 1 parent orchestrator (sole git/integration/durable-state authority) + up to 16 concurrent testing/fixing workers, reused across waves.

## Binding contract (every worker)

1. READ FIRST: this file, your packet `Wxx.md`, root `AGENTS.md`, `apps/mobile/AGENTS.md`.
2. You NEVER run git mutations (no branch/commit/push/stash/reset/clean). No worktrees. No clones. Parent owns Git exclusively.
3. You edit ONLY your packet's **Owned paths** (+ your own packet file). Everything else read-only. Shared hotspots → `NEEDS_PARENT:` block in your packet.
4. **Test-first discipline:** when a test fails, triage BEFORE editing expectations:
   production bug → fix production; wrong test → justify the change in your packet;
   intentional requirement change → cite it; environment issue → document, don't mask.
   Never weaken an assertion to make it pass without a defensible written reason.
5. **Device policy:** ONLY W16 (and parent-coordinated workout journeys) touch the
   emulator (`emulator-5554`, AVD `braintraining35`). Everyone else: no adb/emulator use.
6. **Jest concurrency policy:** run TARGETED suites only (`npx jest <paths> --maxWorkers=2`).
   Do NOT run the full repo suite — the parent owns full-suite runs. Never add retries,
   arbitrary sleeps, or skips to hide flakes; quarantine only understood flakes with a
   documented closure note.
7. Adversarial mandate: attack assumptions (bad input, races, restarts, migrations,
   old data, clock edges, duplicates, scale, malformed state). Pin every discovered
   failing case as a permanent regression test with its seed/scenario.
8. Record honestly in your packet: Failure findings / Fixes performed / Remaining
   NOT VALIDATED items. Defect classification: Critical / High / Medium / Low.
9. Expo SDK 57 docs before touching Expo APIs. No new dependencies without NEEDS_PARENT.
10. Feature freeze: repairs may restructure architecture; new features are out of scope.

## Worker map (wave 1)

| Worker | Area |
|---|---|
| W01 | Validate+harden NEW game attention-sustained-vigilance |
| W02 | Validate+harden NEW game speed-order-sweep (+distinctness vs quick-compare/value-ordering) |
| W03 | Validate+harden NEW game math-value-ordering (+distinctness verdict vs order-sweep) |
| W04 | Validate+harden NEW game memory-prospective-cue (lifecycle interruption focus) |
| W05 | GameHost architecture + migrated-game semantic parity |
| W06 | Cross-catalog contracts over all 42 games (structural + runtime) |
| W07 | Workout V2 lifecycle (DB-backed integration, edge calendar/state cases) |
| W08 | Personalization V2 signal/ranking correctness |
| W09 | Analytics V2 metric equivalence vs reference implementations |
| W10 | Query performance/JSON1 differential testing + benchmarks |
| W11 | Schema v9 migration matrix + repository correctness (BLOCKER-class) |
| W12 | Portability: serializer equivalence + file transport + rollback proof |
| W13 | Engagement transactionality/idempotency attacks |
| W14 | Accessibility rendered-behavior audit + fixes |
| W15 | Platform/deps audit: removed deps, permissions, exports, doctor |
| W16 | Android full-catalog autonomous QA — ALL 42 GAMES (emulator owner) |

## Parent-owned during campaign

Full-suite Jest runs, lint, web export, expo-doctor, openspec gate, registry checks,
cross-system integration pipeline test (§27 of the brief), workout device journey
(coordination with W16), commits, pushes, CI verification on final SHA, durable state,
backlog closure ledger.

## Worker exit protocol

Update YOUR packet file only: Status (COMPLETED/BLOCKED/PARTIAL), Failure findings
(classified), Fixes performed (with test evidence), Remaining NOT VALIDATED.
