# Campaign 066 — critic findings → dispositions

**Change:** `066-adversarial-convergence-static-governance`
**Method:** three independent read-only lanes (static/architecture/contract,
flake/allowlist/debt, governance/state) attacked the 065-closed tree
(`29f31ce`). Each finding below was reproduced before disposition.

## Static / architecture (lane A)

| # | Finding | Severity | Disposition |
|---|---|---|---|
| A1 | Type-only import cycle cluster `db ↔ workout ↔ personalization ↔ rating` (runtime graph acyclic) | Medium | **FIXED (partial)**: `rating/pipeline.ts` now imports from the `@/db/types` leaf; remaining edges recorded in BACKLOG as intentional type-only |
| A2 | `content/registry.ts` imports two game modules' pack validators (platform → game dependency) | Medium | RECORDED: BACKLOG with owner + generator-based fix path (no behavior risk today; needed only if games become removable) |
| A3 | Three components bypass `@/registry/registry` validation via `registry.generated` | Medium | **FIXED**: `mastery-card`, `mastery-insights`, `spotlight-card` use the validated accessors |
| A4 | `hooks/use-theme.ts` imports a settings provider (hooks → components) | Low | RECORDED (BACKLOG) |
| A5 | Generated registry clean (`--check`), 42/42 entries | — | VERIFIED CLEAN |
| A6 | `seedToNumber` duplicated in all 42 games (persisted-seed semantics) | Medium | **FIXED**: single `canonicalSeedToNumber` in `@/sdk`; 42 modules re-export |
| A7 | `clamp01` duplicated in 42 games while a canonical copy exists | Medium | **FIXED**: single `canonicalClamp01` in `@/sdk`; 42 modules re-export; contract test |
| A8 | Content-pack validation helpers duplicated across two games with divergent `ContentPack` shapes | Medium | **FIXED (types)**: shared `PackEnvelope` removes the lying cast; shared validation primitive recorded in BACKLOG |
| A9 | Date-key helpers duplicated with divergent validation (`streaks` throws, `workout/today` rolls over) | Low | RECORDED (BACKLOG) |
| A10 | Test-only UI components with no product importers | Low | RECORDED: adopt-or-drop backlog (no deletion while tests depend) |
| A11 | `content/registry.ts` cast lied about the pack type | Medium | **FIXED** (same as A8) |
| A12 | `parseWorkoutMetadata` cast arbitrary strings to `GameCategory` | Low | **FIXED**: `isGameCategory` guard + drifted-value test |
| A13 | `ARCHITECTURE.md` future-seam/phase text stale | Low | **FIXED**: seam status reconciled |

## Flake / allowlist / debt (lane B)

| # | Finding | Disposition |
|---|---|---|
| B1 | Both provenance waivers are dead exemptions carrying a 2026-11-11 hard-fail (edits merged in `212469d`) | **FIXED**: entries removed; allowlist now empty; self-test invariant updated; KNOWN_ISSUES records the closure |
| B2 | Jest-skip waivers named a closed campaign as owner | **FIXED**: `release-engineering orchestrator` + expiry pointer recorded |
| B3 | No durable pointer for the 2027-03-31 skip expiry | **FIXED** (BACKLOG row) |
| B4 | Deferred items (coverage thresholds, backup fsync, snapshot debt, v12 repair) had no durable backlog row | **FIXED**: BACKLOG rows with owners and closure paths |
| B5 | `KNOWN_ISSUES` "Open non-blocking maintenance" contained resolved rows | **FIXED**: retitled maintenance ledger |
| B6 | `BACKLOG.md` said no successor campaign is active | **FIXED**: names the active program |
| B7 | No `jest.retryTimes`/`--forceExit`/undocumented skips; every allowlist entry has a rationale | VERIFIED CLEAN |

## Governance / state (lane C)

| # | Finding | Disposition |
|---|---|---|
| C1 | 057 `change.json` said OpenSpec 40/40; ledger/VALIDATION say 41/41 | **FIXED**: 41/41 |
| C2 | `STATE.md` header said 056–064 validated | **FIXED**: 056–065 with `CHANGE_065_COMPLETE` |
| C3 | Ledger cursor line said 066 pending while governance binds it | **FIXED**: 066 IN PROGRESS |
| C4 | Untracked perf-baseline residue (13 files) | **FIXED**: removed; the committed 23:58 run set is durable |
| C5 | Git reality, change-package completeness, OpenSpec 50/50, governance cursor falsification, no credential exposure | VERIFIED CLEAN |
| C6 | 067 preconditions missing (package, post-066 artifact, six-way matrix, full journey, terminal ledger) | RECORDED: `RESIDUAL_CENSUS.md` + 067 preconditions checklist |
