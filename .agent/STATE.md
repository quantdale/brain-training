# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-21 (008 Wave 02 recovery: all eight failed parallel sessions salvaged, converged, completed where needed → 36 games; 343 suites / 3926 tests green on convergence branch; duplicates rejected with proof; temporary topology removed)
**Canonical branch:** `main`  
**Active campaign:** `008-wave02-recovery-convergence` (COMPLETED)

## Current status

Campaign 007 (Wave 01 convergence, 24 games) COMPLETED at `d355e47`. The owner-authorized
Wave 02 recovery campaign (`008-wave02-recovery-convergence`) then salvaged the failed
eight-session Wave 02 development and converged it. See `.agent/CURRENT_CAMPAIGN.md` for
the full recovery record and `VALIDATION.md` for exact gate results.

### 008 Recovery summary

- **Sources audited:** canonical dirty tree (sessions 01–06 uncommitted work),
  branch `parallel-wave-02/07-data-content-integrity` (15 commits), branch
  `parallel-wave-02/03-language-logic` (1 commit), worktree
  `brain-training-wt-02` (4 untracked session-02 games), branches 01/04/05/06/08
  (= origin/main, no unique commits), 3 dangling spatial-transform-match WIP
  commits (superseded by salvaged tree), 4 pre-Wave-02 dangling stash commits
  (superseded), `bt-stray-backup` (empty), `Downloads/brain-training-app-starter`
  (stale copy, zero unique files).
- **Convergence:** merge order 07-tip → 03-tip → canonical-dirty salvage →
  wt-02 salvage on `recovery/wave02-full-convergence`; conflicts resolved by
  intent (db idempotency: kept the more mature operation_id implementation;
  streaks atomic apply: kept transactional version over a format-only reformat;
  speed-quick-compare add/add: took complete module versions).
- **Completion:** 9 incomplete salvaged game modules finished by scoped parallel
  agents (~850 new tests); 42 tsc errors in never-validated salvaged test files
  repaired honestly; final Jest failures fixed; lint 0 errors.
- **Rejections (with proof):** math-estimation-sprint, math-number-balance,
  speed-tap-sequence were byte-identical copies of existing catalog games —
  removed from the catalog, content preserved in history (`8540d2c`, merge
  `a19edab`).
- **Catalog:** 36 games (Memory 5, Attention 4, Speed 4, Math 3, Language 5,
  Logic 5, Flexibility 5, Spatial 5), registry regenerated once from the final
  tree.

**Validation on convergence branch (all green):**

- `node scripts/validate-repo-state.mjs`: PASS
- `npx tsc --noEmit` (apps/mobile): PASS (0 errors)
- `npx jest --ci --maxWorkers=2` (apps/mobile): PASS — 343 suites / 3926 tests / 4 snapshots
- `npm run lint` (apps/mobile): PASS — 0 errors (302 warnings, non-blocking)
- `node scripts/generate-game-registry.mjs --check`: PASS (36 games)
- `node scripts/validate-provenance.mjs --check`: PASS
- `node scripts/validate-task-ownership.cjs`: PASS
- `node scripts/validate-offline.mjs --check`: PASS (CLEAN, 768 files)
- `npx expo export --platform web`: PASS
- `npx expo-doctor`: 20/21 (patch-version drift advice; dependencies byte-identical to origin/main — no dependency change in Wave 02)
- `npx --no-install openspec validate --changes`: PASS
- Emulator canary: see VALIDATION.md (emulator-local autobot run)

## Authoritative active change

`openspec/changes/007-parallel-wave-01-convergence/` remains the last validated
openspec change; campaign 008 was an owner-directed recovery executed outside
openspec (salvage + convergence + cleanup).

Fresh-agent entry: `.agent/CURRENT_CAMPAIGN.md` + `AGENTS.md` + `docs/PROJECT_CONSTITUTION.md`

## Important invariants

- GitHub `main` is canonical; no autonomous force-push to `main`
- Android-first autonomous QA; one dedicated AVD by default
- No host physical mouse/keyboard automation
- Up to 7 coder agents only with explicit disjoint ownership
- Generated files are updated through generators only
- Missing validation is never PASS

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant ADRs and Git history
