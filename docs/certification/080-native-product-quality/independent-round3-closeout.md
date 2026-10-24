# Campaign 080 round-3 repair closeout — independent executable acceptance

## Decision

**ACCEPT — bounded to the seven repaired evidence-engine findings at source/contract level.** All seven now fail closed in their adversarial shapes, with relevant positive controls passing. This is **not** acceptance of native catalog certification, Campaign 080, or a final release SHA: native canary/catalog coverage and final-SHA CI remain pending and were not run here.

**Assessed checkout:** `481bf8aaaeb70120a8285d0ad2eb8aa415220e0c` (full SHA; `HEAD` unchanged throughout). Repair ancestry inspected:

- `cdf92af28fa47c8af6284b53ec5d9622f71b5b17` — observed sessions/core session identity and source-backed gameplay policy.
- `292e90881c7b01c6ccf3c3f57153adfe8f4406e0` — observation-specific receipt binding and artifact policy.
- `f42c961f139d7ff4b95b9a83d54777fb60d852f6` — contract/merger convergence and regression controls.
- `481bf8aaaeb70120a8285d0ad2eb8aa415220e0c` — complete tracked app-input manifest requirement.

No source, test, config, or campaign-state files were changed. No emulator, ADB, builds, network changes, owner data, or credentials were used.

## Seven findings — disposition and execution evidence

| Round-3 finding | Decision | Rechecked control and result |
|---|---|---|
| Identityless L2 | **ACCEPT** | Contract adversarial test `P1 identity repro` denies L2 when hierarchy identity is absent. Merger test `M20` reruns the L2-shaped record through the real strict CLI; child exit **1**, certified level 0, no artifact certification. Positive accepted-input/L2 control also passes. |
| Unbound tutorial applicability/prior completion | **ACCEPT** | `W-B3`/`P2-B6` require shipping metadata and typed seq-0 `tutorialStateEvidence`. Verifier CLI `20l` accepts a valid matching SQLite-query JSON/artifact/receipt (exit 0), and rejects false applicability, missing evidence, or query mismatch (exit 1). Sweep tests query a copied SQLite snapshot rather than accepting a ledger boolean. |
| Same-attempt stale hierarchy/receipt replay | **ACCEPT** | Contract `NF-080-002`, merger `M18`, and verifier CLI `20j` reject replay across observation sequence/time; merger strict child exit **1**, safe-exit credit suppressed. Positive controls accept independently acquired identical frames with distinct observation receipts (`20k`) and a real proven safe exit (`M8`/`P1`). |
| Equal-score stale results | **ACCEPT** | Contract test `P1 equal-score repro` rejects adjacent equal-score results without current-session token/event: resultsCurrent/sessionEnded are not VERIFIED and L3 is not awarded. Session-token mismatch remains rejected even with equal/final scores (`P2-B3`). Positive current-session L3 (`M11`, `P4`) passes. |
| Uncontracted passive L2 | **ACCEPT** | Answer-driven Pair Recall timeout/score-change probes (`A3`, `P3`) no longer earn autonomous credit/L2. Passive eligibility is game-specific in `gameplay-policy.mjs`; Pair Recall is absent. Positive passive timer-completion control for `memory-sequence-memory` reaches its allowed L3 (`N11`). |
| Empty strict merger exits 0 | **ACCEPT** | Merger test `M19` observes real strict-child exit **1** on zero runs; lenient mode remains exit 0 but `NON_CERTIFYING`. Independently ran the strict CLI on a schema-2 empty ledger: process exit **1**, output totals 0/0, `NON_CERTIFYING`. |
| Non-ISO coercible timestamps | **ACCEPT** | Contract test `P2-B4/NF-080-008` rejects RFC-2822 event timestamps and awards no level; verifier CLI `20m` rejects non-ISO receipt/event timestamps (child exit 1). Valid ISO/RFC-3339 timezone-bearing timestamps remain positive controls. |

Tutorial applicability and core session identity are derived from source-backed records: game metadata is loaded from shipping `game.json`; reducer-owned `sessionId` is exposed by `GameHost` as a hierarchy token in session/results; the sweep parses game identity and token from acquired UIA XML. Passive rules are an allowlist for documented timer/reducer semantics, not a run-supplied eligibility claim.

## Execution record

1. `node scripts/validate-repo-state.mjs` — exit **0**, repository-state validation PASS.
2. `node --test scripts/qa/coverage-contract.test.mjs scripts/qa/coverage-contract.adversarial.test.mjs scripts/qa/verify-artifacts.cli.test.mjs scripts/qa/merge-coverage.test.mjs scripts/qa/native-game-sweep.test.mjs` — exit **0**, **171/171 passed**, zero failures/skips. This included the exact named controls above plus positive artifact, result-session, tutorial-returning-player, allowed-passive, empty-ledger and full-input-manifest controls. CLI tests assert actual child process codes.
3. Replayed the preserved reviewer fixture from `scripts/qa/test-fixtures/080-review/reviewer-adversarial-probes.mjs`, relocating only imports and output path into `review-scratch/round4` — process exit **0**. It now reports failed tap `AMBIGUOUS_CAUSALITY`/input FAILED; tutorial masquerade L0; forged exit FAILED; empty evidence verifier FAIL/exitCode 1; cross-build relabel, case-alias reuse and copied cross-attempt evidence FAIL/exitCode 1.
4. Re-executed the seven prior-round direct probe script recovered from the stored original session, redirected to round-4 scratch — process exit **0**. Its legacy records are now rejected as invalid (they lack current typed SQLite evidence, observed hierarchy resource-ID bindings, or the receipt schema), so their axes are NOT EXECUTED/level 0; this run is treated as a legacy-schema rejection control, **not** as the basis for accepting individual repairs. The updated direct/CLI/merger tests in item 2 supply the valid-schema, finding-specific reproductions.
5. Manually ran the strict empty-ledger merger — process exit **1**, as required.

Logs/temporary files are confined to ignored `review-scratch/round4`; generated ledgers/fixtures were removed after execution. Final `git status --short --branch` showed only the detached-HEAD line; `git diff --exit-code` and `git diff --cached --exit-code` passed. No staged files.

## New findings and limits

- **New P1:** none found in the repaired evidence-engine scope.
- **New P2:** none found in the repaired evidence-engine scope.
- **Medium / Low:** none raised in this bounded review.
- The external `all-tracked-app-files-v1` manifest and operator-provided receipt index establish **consistency**, not cryptographic provenance or device attestation. This is the explicitly accepted trust boundary, not a new defect. The manifest positive fixture checked all tracked `apps/mobile` inputs and APK/source binding; it is source-level evidence, not a real built/installed final-SHA APK.
- The five Node suites and source-backed fixtures do not establish native canary/catalog behavior, a fresh 42-game sweep, or final-SHA hosted CI. Those gates remain **NOT RUN / PENDING**, not accepted here.
- The separately reported DataManagement UI issue was excluded as requested.

**Closeout verdict:** ACCEPT the seven repair implementations for this independent executable round-3 repair-acceptance task only. Do not promote this to native/product/release certification until the pending canary/catalog and final-SHA CI evidence is independently reconciled.
