# Campaign 009 — Single-Session Broad Multi-Worker Development

**Status:** IN PROGRESS → closing (Day mode)
**Campaign id:** `009-single-session-broad-development`
**Predecessor:** `008-wave02-recovery-convergence` (COMPLETED at `d1b371f`; 36-game catalog)
**Execution entry:** owner-directed single-session orchestrator brief + `docs/PROJECT_CONSTITUTION.md` + `AGENTS.md` + `.agent/STATE.md`

## Mission

One authoritative parent orchestrator coordinated up to 16 specialized worker
agents in a single session to materially advance many independent product
areas at once — with strict write ownership, no temporary git topology, and
parent-only integration/convergence authority. Explicitly NOT a repeat of the
Wave 02 eight-independent-session failure: workers never branch, commit, or
touch shared/generated files.

## Topology

- 16 worker packets defined in `.agent/_tasks/campaign009/` (README contract +
  per-worker packets W01–W16), each with disjoint write surfaces.
- Workers: read anything, write only owned paths, no git mutations, no
  registry/manifest/schema edits (single DB worker exception), report shared
  needs to the parent.
- Parent: architecture, integration, registry regeneration (exactly once),
  cross-worker seams, validation, commits, pushes, durable state.

## Worker contributions (all claims verified by parent spot-checks + full gates)

- **W01 Memory+Attention:** fixed attention-target-count pause/resume timing
  exploit (unlimited think time inflated scores; gameVersion → 1.1.0) and its
  always-"correct" sensory feedback. NEW GAME `memory-pair-recall`
  ("Pair Recall"): associative pair recall with deterministic re-pairing
  (proactive interference / working-memory updating); mechanically distinct
  from sequence/grid/order/span mechanics; full vertical slice, 63 tests.
- **W02 Speed+Math:** fixed speed-color-match wall-clock reaction timing
  (now injectable monotonic clock) and pause window re-baselining;
  fixed math-equation-builder undo leaving an impossible `[num, num]` token
  state (one stale test assertion corrected — it pinned the bug). NEW GAME
  `math-number-line-estimation` ("Number Line"): magnitude interpolation on a
  seeded number line, bounded-error scoring; distinct from all existing math
  mechanics; 65 tests.
- **W03 Language+Logic:** CRITICAL — logic-deduction-table's uniqueness prover
  enumerated only the first two consistent permutations and shipped ambiguous
  rounds (8 concrete counterexamples found); replaced with exhaustive sound
  enumeration + regression suite. HIGH — language-sentence-builder falsely
  rejected valid clause-swapped reconstructions (~35 sentences); curated
  accepted-order alternatives added. Fixed word-chain degenerate-pool crash,
  ambiguous/non-word content items; expanded context-fit 42→60 items and
  word-chain 18→21 chains; added independent solver/uniqueness property suites
  for code-cracker, deduction-table, order-path, rule-grid.
- **W04 Flexibility+Spatial:** nine defect fixes with regression tests:
  task-switch generator re-forked constant salts (identical stimulus every
  round); rule-flip constant block lengths; stroop neutral trials on
  unanswerable slots, session-ending first timeout, dead-ended flip-cue phase,
  fabricated reaction times (`800+random*400`), capped perfect-run score, and
  inexact force-win; fold-match keep-base contradiction producing degenerate
  distractors. Added five property/invariant suites (rotation identity/
  composition/involution, equivalence-class symmetry/transitivity, fold
  brute-force reference, generator bounds). Declined category expansion under
  the quality bar (documented).
- **W05 Game platform:** FIXED silent production audio failure — context-fit
  and cue-shift correct/wrong SFX names were missing from `SFX_ALIASES`
  (resolved to nothing); added aliases + SDK-level invariant tests replacing
  the drifted hand-maintained list. NEW `catalog-contracts.test.ts`: 16
  source-scanning contract tests over every game module (lifecycle, pause,
  QA gating, testIDs, tutorial, adaptive, persistence, sensory vocabulary).
- **W06 Workout:** NEW end-to-end lifecycle suite against real db+registry
  (selection→resume→advance→completion→reroll→rollover→restart→partial);
  fixed reroll being allowed on COMPLETED workouts (debited coins for
  nothing); fixed corrupted negative currentIndex mis-placing resume via
  slice semantics; added staleness tier to personalization (opt-in clock
  injection, explainable reasons); verified invalid-id reconciliation and
  catalog-growth behavior.
- **W07 Rating+Progression:** closed three NaN/±Infinity propagation paths
  (challenge expectation, XP→level, composite averages), duplicate-domain
  double-move guard, O(n²)→linear composite fallback; 24 invariant tests
  (monotonicity, easy-farm protection, boundedness, idempotent replay).
  No curve-semantics changes.
- **W08 Engagement+Economy:** fixed unusable Shield (delegated to
  Freeze/Recovery predicates AND consumed the wrong item); duplicate streak
  item application no longer burns extra inventory; achievement/quest claims
  stamp ledger operationIds (schema-enforced idempotency vs double-tap and
  backup re-import); transactional cosmetic equip; rewards hub loads
  lightweight projection + in-flight guards; rollover/timezone/large-history
  coverage.
- **W09 Progress+Insights:** training-balance card across the 8 domains,
  domain personal bests, window series, recent-form, extended
  recent-vs-lifetime (accuracy/reaction/difficulty with correct
  lower-is-better semantics), staleness indicators, explainMetric captions;
  new-player-guarded so visual baselines stay stable. No fabricated metrics;
  no efficacy claims.
- **W10 Database (single schema worker):** BLOCKER FIX — v8 migration could
  brick startup on legacy data (append-only trigger aborted the backfill
  transaction; duplicate legacy 'gameplay' rows violated the partial unique
  index); v8 is now collision-safe inside one atomic transaction with the
  trigger restored (5 new migration regressions). Activity-date queries moved
  UTC→localtime matching the repo local-calendar convention. Corrupt JSON
  rows degrade to null instead of crashing reads. Clock-consistency fixes.
- **W11 Portability+Content:** HIGH — backups with foreign profile ids created
  invisible second profiles on restore; now normalized to the local singleton.
  Cosmetics merge unions `owned` (no more disowned cosmetics); typed early
  rejection of DB-invalid backups (ranges/FKs) before any destructive step;
  64 Mi pre-parse DoS gate; version-gate hole closed; exact COUNT(*) wipe
  confirmation; unified FK delete order + dynamic all-tables wipe test.
- **W12 Accessibility+Shell:** shared `components/a11y.ts` (44pt targets);
  truthful roles/selected states (favorite toggle, active-session marker),
  polite live regions for async outcomes (results headline, import/export,
  storage recovery, streak-at-risk), contextual rotor labels, switch labels
  self-contained; 43 rendered/static contract tests incl. rename-detection
  over all owned surfaces.
- **W13 Performance:** evidence-based audit with measured baselines (listRecent
  vs lightweight 6.7×, export canonicalization ~2.4s @5k sessions, progress
  snapshot 101ms @20k); six deterministic perf guards + opt-in probe runner +
  baseline JSON. Findings routed to parent; F2 (profile heavy loads) applied
  at convergence; F3–F6 documented as debt.
- **W14 Android QA harness:** removed stale hardcoded 24-game list — catalog
  now derived from game.json files and cross-checked against the generated
  registry (drift fails loudly); richer smoke chain (interaction probe,
  back-nav, next-game, persistence evidence); machine-readable failure
  artifacts; graceful BLOCKED path without a device; self-test extended.
  Two helpers dropped during the rewrite were restored by the parent after
  the first device run exposed them.
- **W15 CI/Test infra:** OpenSpec validate gate ADDED to CI (was missing;
  scoped `@fission-ai/openspec` pin), job timeouts, concurrency group, jest
  cache, failure-artifact upload; flakiness triage (no retries/skips; wall-
  clock assertions flagged); NEW `src/test-utils/**` deterministic fixture
  infrastructure (98 tests) + structural catalog contract parameterized by
  registry membership.
- **W16 Cross-platform/architecture audit (reports only):**
  `docs/audits/campaign009-xplat-audit.md` (fix-now/watch/needs-macOS
  classifications) and `docs/audits/campaign009-architecture-debt.md`
  (D1 GameHost consolidation, D2 backup transport wiring, D3 sync-readiness
  seams, D4 perf instrumentation, D5 a11y continuation, D6 deferred content
  architecture).

## Catalog

36 → **38 games** (registry regenerated exactly once from the final tree):

- Memory 6 (+Pair Recall), Attention 4, Speed 4, Math 4 (+Number Line),
  Language 5, Logic & Problem Solving 5, Flexibility 5, Spatial 5.

Rejected expansions (quality bar): sustained-vigilance Attention game (not
built this session; top follow-up candidate), Speed addition (no clearly
distinct mechanic), Flexibility/Spatial additions (declined by W04 as not
sufficiently distinct).

## Parent convergence fixes (from worker reports)

- `paidReroll` now checks balance inside its transaction (negative-balance
  race closed) + regression test.
- Profile screen: per-kind in-flight purchase guard (double-tap), achievement
  ratios from the authoritative aggregation snapshot (uncapped), lightweight
  session projection for quest evaluation, SQL distinct local activity dates.
- Data-management import reuses the preview's validated payload (no second
  full parse per import).
- speed-color-match tutorial demo timer cleaned up on unmount.
- Reward celebration: Android elevation, reduced-motion static presentation,
  screen-reader announcement.
- Theme `BottomTabInset` gained the missing `web` key.
- number-line feedback calls aligned to literal-call convention so the
  catalog sensory gate stays strict (scanner false-positive eliminated
  without weakening the assertion).
- word-scramble received the catalog's last missing screen test suite.
- Visual baselines for Games/Profile regenerated deliberately (a11y props are
  intentional DOM changes).

## Validation

See `.agent/VALIDATION.md` entry "Campaign 009" for exact gate results.

## Exit criteria

- [x] 16/16 worker packets completed with disjoint ownership preserved
- [x] New games meet the README quality bar (determinism, adaptive, pause,
      QA hooks, tutorial, a11y, sensory, persistence, tests)
- [x] Critical/High defects repaired (deduction-table prover, v8 migration,
      invisible-profile import, pause exploits, silent SFX, reroll-on-completed)
- [x] Registry regenerated once; generators --check PASS
- [x] Full gates green (tsc, lint errors=0, Jest, web export, offline,
      provenance, task-ownership, repo-state, OpenSpec)
- [x] Android emulator QA executed via autobot (37/38 games verified through
      the full journey chain; grid-nav force-win path open — KNOWN_ISSUES)
- [x] No temporary branches/worktrees; parent-only commits
