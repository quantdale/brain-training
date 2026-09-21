# Campaign 065 — critic findings → fixes

**Change:** `065-adversarial-convergence-runtime-data-pixel`
**Method:** six independent read-only critic lanes attacked `a9111c3`
(source/runtime, tests, data/persistence, pixels/a11y,
governance/artifact, reintro-guards/repeatability). Every finding was
re-verified against the code before it entered the spec; every fix below
landed with a focused regression test.

## Source/runtime

| Finding | Fix | Proof |
|---|---|---|
| Replace import with matching fingerprint + empty definitions bricks bootstrap (FK loop) | Replace path strips the imported fingerprint; seeding trusts a matching fingerprint only when both catalogs are non-empty (`package`/`achievement` `countDefinitions()`) | `replace-import-progression.test.ts` (crafted envelope → bootstrap ready, catalogs restored); negative run against pre-fix code fails with `FOREIGN KEY constraint failed` |
| `initDatabase` re-entry leaks connections / splits the write queue | Idempotent: returns the live instance; in-flight promise cleared only on rejection; `resetDatabaseForTests()` seam for suites needing fresh DBs | `init-retry.test.ts` (same instance, factory once, coalescing, failure retry) |
| Wipe/replace never invalidates in-memory workout state | `emitWorkoutChanged()` after successful import (merge/replace) and wipe | `data-management.test.tsx` subscriber assertions (065 cases) |
| PB badge can fire for a future-dated session (`<= 1` matches 0) | `atOrAbove === 1` | `results-hero.test.tsx` (no PB for out-of-universe; PB for first in-universe session) |

## Data/persistence

| Finding | Fix | Proof |
|---|---|---|
| FK pragma missing on the expo transaction connection | Transactions now run on the main (pragma'd) connection with the pragma re-asserted through the txn adapter before `BEGIN`; `withExclusiveTransactionAsync`'s new-connection behavior is documented as the reason; ROLLBACK failure no longer masks the body error | `adapters/__tests__/expo.test.ts`: statement order `PRAGMA foreign_keys = ON` → `BEGIN` → body → `COMMIT`; rollback propagation |
| Repair/reconcile blind RMW and blind DELETE vs advance CAS | `observeRepair` + `applyRepair` CAS on date/current_index/status/raw `game_ids_json`; DELETE predicates on the observed row; `reconcileActiveInstances` re-observes | `workout-repair-cas.test.ts` (7 cases incl. stale-repair-vs-advance, stale-delete-vs-complete) |
| `applyReroll` CAS omits `game_ids_json` | Raw-bytes predicate added | same suite (TOCTOU case) |
| Streak purchase random `operationId` defeats retry idempotency | Per-intent key map retained across failures, cleared only on success; double-tap reuses in-flight intent | `profile-purchases.test.tsx` (stable key on retry; repository-boundary debit-once) |
| `domain_ratings.updated_at` can regress | `MAX(domain_ratings.updated_at, excluded.updated_at)` | `rating.test.ts` (T2 then T1 → T2) |

## Tests

| Finding | Fix | Proof |
|---|---|---|
| QA-gate production-safety suites dead (`if (NON_MIGRATED.length > 0)`) | Shared-host dev-only checks run unconditionally (dev-flag refusal, tutorial `skipForQa` gating); per-game list stays conditional; roster pin preserved | `non-migrated-qa-gates.test.ts --verbose` → 3/3 executed |
| Skip allowlist substring absorbs new skips | Schema v4: `expectedMatches` per entry enforced (`COUNT_MISMATCH_JEST_SKIP`); floors `minTotalSuites`/`minTotalTests` enforced | self-test negative fixture (extra skip in allowlisted suite → fail); `--check-allowlist` |
| Console guard bypassed by `jest.spyOn(console, …)` in 45+ files | Guard locks its methods (non-configurable) + identity check; every spy site converted to `expectConsoleNoise` | grep `spyOn(console` → 0 hits (comment only); 50 suites converted and green |
| Warning counters structurally zero; README said v2 | Always-zero `warningCounts` removed; README rewritten for v4 | validator output; no unearned counter claims |
| No suite/test floor | Reviewed floors in the allowlist | below-floor fixture fails with `JEST_SUMMARY_BELOW_FLOOR` |
| Tautologies / zero-assertion tests / unseeded randomness / module-level clocks / wall-clock timing | Two tautologies removed, two tests given real assertions, five files seeded, two route tests freeze `Date.now` per test, timing assertion replaced by a functional one | targeted suites green; files listed in the packet report |

## Pixels/a11y

| Finding | Fix | Proof |
|---|---|---|
| In-session results/failure states silent | `result-artifact`, `persist-error`, `workout-advance-error` carry polite live regions (mirroring `/results`) | `results-reward.test.tsx` announcement tests |
| `ResultRow` split a11y nodes | One accessible statement (`label: value`); contract test re-pinned | `result-row.a11y.test.tsx` |
| Fixed-size color-match buttons at font scale 2 | Fixed width/height → `minWidth`/`minHeight` | `color-button.test.tsx` (minimums pinned, no fixed height) |
| 36 dp answer chips; other sub-44 dp controls | `minHeight: MinTouchTarget` (or hit-slop) across 7 game components proven by the new guard | catalog matrix touch-target guard + `word-grid.test.tsx` |
| Two tutorials bypass `TutorialFrame` | Both migrated to the shared frame; contract now requires it (empty exemptions map) | `catalog-contracts` + per-game tests |
| Pause overlay row cannot wrap | `flexWrap: 'wrap'` + centering | `pause-overlay.layout.test.tsx` |
| PB/fc2/compact/dark gameplay coverage for 41/42 games, landscape, RTL, long strings | deferred with reasons | recorded in the audit map; 067 six-way matrix |

## Reintro guards (new)

| Guard | Location | Catches |
|---|---|---|
| Duplicate score statement | `catalog-persistence-matrix.test.tsx` (all-42 success case) | a second score-shaped testID under `result-facts` (the historical class); an untestID'd or differently-shaped extra numeral is not covered |
| Pause wiring | same + `game-host.test.tsx` | missing/covered pause control; header strip losing row+wrap |
| Touch-target floor | same (rendered interactive nodes, declared `minHeight`/`height` + vertical hit-slop ≥ 44) | sub-44 dp declared controls catalog-wide; a control clipped by a parent, or the pause overlay/dialog controls, are outside this scan |
| Tutorial adoption | `catalog-contracts.test.ts` | tutorial not rendering `TutorialFrame` in source; in-frame overflow stays device-only (067) |

## Governance/evidence

| Finding | Fix |
|---|---|
| Governance said no campaign while 056→067 is active | `GOVERNANCE.activeProgram` registered (prompt, ledger, current change, mode, start SHA); `validate-repo-state.mjs` reconciles it and prints it; STATE.md + CURRENT_CAMPAIGN banner updated; task-ownership records the program |
| `productBaselineCommit` mislabeled artifact source | 063/064 keep the pre-change baseline and add `certifiedArtifactCommit: e627473` |
| 064 probe baselines untracked | the five final 064 run baselines are committed as part of the 065 change commit |
| Campaign-055 evidence overclaims | dated correction notes appended to the four affected documents (append-only history) |
| Ledger header named the pre-program APK; stray `.gitignore` line; 063 re-scope unexplained | corrected/annotated |
| In-repo `qa-artifacts/` (20,916 files) + `dist/` | `dist/` removed; `qa-artifacts/` removal blocked by emulator-held log handles (gitignored, disposable) — retried after the device pass |

## Closure verification (second adversarial pass)

A closure verifier attacked the implemented fixes. Four residual items
were found and repaired:

| Finding | Fix |
|---|---|
| PB could still fire for a future-dated session when one earlier at-or-above session existed (`atOrAbove === 1` with the session itself excluded) | `isPersonalBest` rejects any session whose `completedAt` is in the future before counting; regression test `results-hero.test.tsx` (future-dated + earlier at-or-above → no badge) |
| Allowlist pins could still absorb a renamed skip one-for-one (substring + count) | Schema v4 now requires `testFullName` and matches the exact reviewed full name; the count check stays as a second net |
| `activeProgram` was not cross-checked against the ledger's current change | The ledger carries `**Current change:** \`<id>\``; `validate-repo-state.mjs` fails on a mismatch and on a missing field |
| Evidence wording (baseline durability tense, "catalog-wide" guard scope) | wording corrected; guard limitations stated explicitly |

The verifier's other attacks (transaction rewrite, init idempotence,
progression brick, workout CAS, console lock, floors, governance
terminal invariants) did not falsify any fix.
