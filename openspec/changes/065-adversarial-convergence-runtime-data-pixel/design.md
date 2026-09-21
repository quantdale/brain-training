# Design — 065-adversarial-convergence-runtime-data-pixel

## Fix designs

### 1. Progression fingerprint (bootstrap brick)

Two layers:

- **Primary:** in the replace-import branch, strip the seed fingerprint
  key from the imported profile settings before persisting, so the next
  `ensureProgressionDefinitions` seeds. (Merge mode keeps local settings
  and is unaffected.)
- **Safety net:** `ensureProgressionDefinitions` verifies the persisted
  catalogs are non-empty (or match the in-code definition ids) before
  trusting a matching fingerprint; on mismatch it re-seeds idempotently.

Regression test: craft the envelope (empty definitions + current
fingerprint), apply replace, run bootstrap/refresh, assert Home-reachable
state and no FK error.

### 2. Device transaction FK

In `createExpoSqliteAdapter.transaction`, call
`await txn.execAsync('PRAGMA foreign_keys = ON')` on the transaction
connection before invoking the callback, with a comment explaining that
expo opens a new connection for exclusive transactions. Adapter contract
test asserts the pragma is issued first and that a violating insert
rejects (test double for the expo txn surface).

### 3. Init idempotence

`initDatabase` returns the existing `instance` when present (before the
promise coalescing check); the in-flight promise is retained until it
settles and only cleared on rejection. Test: success → call again →
same instance, adapter factory called once; failure → retry succeeds.

### 4. Workout repair CAS

`persistRepaired` UPDATE gains `AND current_index = ? AND status = ? AND
game_ids_json = ?` (the observed row); `reconcile`'s DELETE gains
`AND current_index = ?`. `applyReroll` compares and predicates on the raw
`game_ids_json` bytes it read. Tests interleave a repair with an
`advanceForSession` commit deterministically.

### 5. Portability emissions

After a successful replace/merge import and after a successful wipe,
call the existing workout change emitter (single call site each).

### 6. Economy/rating time safety

- Streak-item purchase: keep an intent ref (`useRef`) keyed once per
  pending purchase; the retry path reuses it; cleared on confirmed
  success.
- `domain_ratings` UPSERT: `updated_at = MAX(domain_ratings.updated_at,
  excluded.updated_at)`.
- PB: `atOrAbove === 1`.

### 7. Test signal

- **Live QA gates:** the shared-host dev-only assertions move to an
  unconditional describe; per-game rows stay under `it.each` of the
  (currently empty) non-migrated list, while the roster pin continues to
  assert 0.
- **Exact skip pinning:** allowlist schema v4 adds
  `expectedMatches` (positive integer, default rejected) and, where used,
  `testPattern` remains; the validator counts matches per entry and fails
  when matched ≠ expected or when one skip matches multiple entries. The
  five shipped entries get `expectedMatches: 1`. Self-test gains an
  "extra skip inside allowlisted suite" negative fixture.
- **Console-spy detection:** `installConsoleSignalGuard` records the
  installed wrapper per level; `assertNoUnexpectedConsoleOutput` fails
  when `console[level]` is no longer that wrapper. All 45+ spy sites are
  converted: expected noise becomes `expectConsoleNoise(pattern, async
  () => { … })`; spy-based assertions are replaced by the helper's
  occurrence assertion. Conversions are mechanical per file with the
  message captured from the source under test.
- **Honest counters + floors:** drop the always-zero warning fields from
  the report; add `minTotalSuites`/`minTotalTests` (reviewed constants
  pinned in the allowlist file) and fail below; fix the README schema
  version. Test hygiene: delete two tautologies, add assertions to two
  zero-assertion tests, seed four unseeded shuffles, remove the
  wall-clock 1 s timing assertion.

### 8. Reintro guards

- **Duplicate score:** in the existing all-42 `catalog-persistence-matrix`
  success case, assert `≤ 1` node under `result-facts` whose testID
  matches the game's score id.
- **Tutorial adoption:** tighten `catalog-contracts` to require
  `TutorialFrame` (with an explicit exemptions map) and migrate the two
  speed games onto the frame.
- **HUD wiring:** assert the pause testID is present for every game in
  the catalog matrix, and pin the header strip's wrap style in
  `game-host.test.tsx` through the real wiring.
- **Touch targets:** walk interactive nodes in the rendered session and
  assert `minHeight + vertical hitSlop ≥ 44`; fix the live
  `language-sentence-builder` chips and any other failures the guard
  surfaces.

### 9. In-session a11y + sizing

Announce the in-session headline and error lines (reuse the existing
live-region pattern), combine `ResultRow` label/value into one accessible
statement with an updated contract test, switch color-match buttons to
minimum sizing, raise the answer chips, and let the pause overlay action
row wrap.

### 10. Governance/evidence

Register the program in `GOVERNANCE.json` + `CURRENT_CAMPAIGN.md` +
`task-ownership.json`; set `productBaselineCommit`/add
`certifiedArtifactCommit: e627473` for 063/064; commit the 064 probe
baselines; correct the falsified campaign-055 sentences with a dated
correction note (evidence is append-only: corrections, not rewrites);
fix the ledger header, `.gitignore` stray line, and record the 063
re-scope.

## Evidence layout

`docs/redesign/evidence/campaign065/`: `CRITIC_FINDINGS.md` (lane →
finding → fix → proof), `REPEATABILITY.md` (six bounded re-runs),
`CONSOLE_SPY_CONVERSION.md` (files touched + before/after semantics),
`DEVICE_065.md` (bounded adversarial device pass),
`CAMPAIGN065_CLOSURE.md`. Raw logs under `D:\Temp\campaign065-*`.

## Re-certification boundary

065 changes product source, so the 063 artifact stays the *last
certified* artifact but no longer matches HEAD. 067 builds and certifies
the final artifact; 065 runs only the bounded device probes listed in
the proposal.
