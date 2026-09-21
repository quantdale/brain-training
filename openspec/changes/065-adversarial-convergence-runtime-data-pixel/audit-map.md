# Audit map — 065-adversarial-convergence-runtime-data-pixel

**Program SHA:** `428d293` · **Predecessor:** `064-dependency-security-validation-gates` (VALIDATED)

Six read-only critic lanes attacked `a9111c3`; every finding below was
re-verified against the code before it entered the spec.

| Lane | Finding | Severity | Disposition |
|---|---|---|---|
| source/runtime | Replace import with matching fingerprint + empty definitions → permanent bootstrap loop | High | FIX (seed trust + import strip) |
| source/runtime | `initDatabase` re-entry leaks a connection / duplicates the write queue | Medium | FIX (idempotent init) |
| source/runtime | Wipe/replace never invalidates in-memory workout state | Medium | FIX (emit change) |
| source/runtime | PB badge can fire for a future-dated session (`<= 1` matches 0) | Low | FIX (`=== 1`) |
| source/runtime | Cold deep-link + bare `router.back()` in game screens | unverified | DEFER to 067 device probe (recorded) |
| data | FK pragma missing on the expo transaction connection | High | FIX (pragma on txn) |
| data | Repair/reconcile blind RMW and blind DELETE vs advance CAS | Medium | FIX (CAS predicates) |
| data | `applyReroll` CAS omits `game_ids_json` | Low | FIX (predicate) |
| data | Streak-item purchase uses a random operation id | Medium | FIX (stable intent key) |
| data | `domain_ratings.updated_at` can regress | Low | FIX (`MAX`) |
| data | v12 repair keeps earliest history but not matching rating | Low | DOCUMENT (product/migration decision; not silently changed) |
| data | Backup rename lacks fsync (power-loss window) | Low | DOCUMENT (expo-file-system surface); BACKLOG |
| tests | QA-gate production-safety suites are dead code | High | FIX (unconditional registration) |
| tests | Skip allowlist substring absorbs new skips | High | FIX (exact pinning, v4) |
| tests | Console guard bypassed by `jest.spyOn(console, …)` in 45+ files | High | FIX (detection + conversion) |
| tests | Warning counters structurally zero; README says v2 | Medium | FIX (drop fields, README) |
| tests | No suite/test floor | Medium | FIX (pinned minimums) |
| tests | No coverage measurement/thresholds | Medium | DEFER (documented; post-067 hardening decision) |
| tests | Wall-clock timing assertion (<1000 ms), real-timer sleeps | Low/Medium | FIX the 1 s assertion + hygiene; celebration timer documented with owner |
| tests | Two tautological assertions, two zero-assertion tests | Low | FIX |
| tests | Unseeded `Math.random` fixtures (4 files) | Low | FIX (seeded helpers) |
| tests | Module-level `Date.now()` in two route tests | Low | FIX (injected/frozen clock) |
| tests | Snapshot regeneration review debt | Low | DOCUMENT (BACKLOG) |
| pixels/a11y | In-session results/failure states never announced | High | FIX (live region) |
| pixels/a11y | Fixed-size color buttons with scaling labels | Medium | FIX (minimums) |
| pixels/a11y | 36 dp answer chips without hit-slop | Medium | FIX (44 dp floor) |
| pixels/a11y | Pause overlay row cannot wrap | Medium | FIX (wrap) |
| pixels/a11y | Two tutorials bypass `TutorialFrame` | Medium | FIX (migrate) |
| pixels/a11y | `ResultRow` split a11y nodes; dialog height; grid role; radio semantics | Medium/Low | FIX ResultRow; document dialog/role/radio as bounded |
| pixels/a11y | Gameplay fs2/compact/dark captures for 41/42 games; landscape; RTL; long strings | gaps | DEFER to 067 six-way matrix (recorded) |
| governance | Governance says no active campaign during 056→067 | Medium | FIX (register program) |
| governance | `productBaselineCommit` mislabels certified artifact source | Medium | FIX (e627473 / new field) |
| governance | 064 probe baselines untracked though claimed tracked | Medium | FIX (commit baselines) |
| governance | Campaign-055 evidence falsified rows + unreproducible claim | Medium | FIX (dated correction notes) |
| governance | Ledger header stale APK; stray `.gitignore` line; 063 re-scope unannotated | Low | FIX |
| governance | In-repo `qa-artifacts/` + `dist/` | Low | CLEANUP (gitignored) |
| guards | No catalog guard for duplicate score / tutorial adoption / HUD wiring / touch targets | deliverable | ADD shared guards |
| repeatability | Six bounded re-runs identical, no flake/order-dependence | none | RECORD |

## Boundaries

No new features; the 063 artifact keeps certification until 067 rebuilds.
v12 repair semantics, backup checksum/fsync, coverage infrastructure, RTL,
landscape, and snapshot review debt are explicitly deferred with reasons.
