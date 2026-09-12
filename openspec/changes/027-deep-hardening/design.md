# Design — Campaign 027: Deep Hardening

## Strategy

Work risk-ordered: fix real defects first (small, high-confidence, with
regression tests), then close the highest-value test gaps, then make the
unbounded performance paths bounded and observable, then harden CI/tooling,
then truth the documentation, then remove dead weight. Every item is
verified by the strongest practical check before its commit; nothing is
declared fixed from code reading alone.

## Priority model

`impact × confidence × executability ÷ risk`, with these rules:

- Any P0 found during the campaign preempts the current item and is repaired
  immediately (none known at activation).
- P1 items (unbounded hot-path reads, silent cap bypass) come before P2 polish.
- Repairs to versioned game logic (generator/scoring/difficulty/session) must
  bump the corresponding version field and pass the provenance validator; a
  repair that cannot be expressed without silently reinterpreting old results
  is rejected or explicitly deferred.
- Persistence formats are not changed. If a type fix (e.g. `fastestReactionMs`)
  alters only the *newly written* raw result shape inside an already-versioned
  envelope, the game's raw-result version is bumped; stored legacy values keep
  their existing coalescing behavior.
- No new dependency, no major upgrade, no feature work.

## Correctness repair designs

1. **Vigilance stimulus lifetime:** derive visibility from
   `state.outcome === null` in addition to the stimulus phase, so a resolved
   trial hides the digit immediately; the verdict badge (Campaign 025
   language) remains. Guard: screen test asserting the digit is gone the
   moment a GO trial resolves.
2. **Color-stroop dead actions:** delete the unreachable `show-stimulus` and
   `show-flip-cue` actions and their reducer cases; the live flow uses
   `next-trial`/`trial-timeout`. If a rule-change dispatch is genuinely needed
   by the current UX, wire it behind an explicit phase guard instead — decide
   from the current screen code.
3. **Speed-color-match non-finite metric:** `fastestReactionMs` becomes
   `number | null` in the raw result, set to `null` when no correct trial
   exists; the rating-metric extraction already coalesces. Bump the
   raw-result version.
4. **Spatial-coordinate-turn adaptive escalation:** treat `directions` as the
   declared continuum (min/max), regenerate the adaptive axis on `next-round`
   from the reached performance, and pass the reached parameters into the
   challenge-rating record. `next-round` stays pure; the derived parameters
   live in state so replay/tests stay deterministic. Guard: difficulty test
   asserting escalation across successful rounds, plus the existing adaptive
   screen test updated from "minimum challenge" to "reached challenge".
5. **Word-scramble dead budget:** remove `roundTimeMs` from the difficulty
   contract and session generatorInfo, bumping the generator version; the
   game is untimed by design and the field has no reader.

## Performance designs

1. **Bounded quest evaluation:** the production call path must not scan
   unbounded history for short-period quests. Approach: evaluate period
   windows from the persisted quest period keys and a bounded sample (reusing
   the existing `SYNC_SESSION_SCAN_LIMIT` semantics), keep lifetime
   achievements on O(1) aggregates, and document the deliberate bound.
   Invariant: identical quest/achievement values for all supported histories
   (`progression` suites pin the numbers).
2. **Profile focus reuse:** compute the sync samples once per focus and reuse
   them for the second `listLightweight` read instead of scanning twice.
3. **Version-gated bootstrap:** store a seeding/guard version in `profile`
   settings; skip definition upserts and trigger re-creation when the stored
   version matches the code. Fail-closed: unknown/absent version runs the
   full path.
4. **Observability first:** add `markPerfEvent` phases around database init,
   seeding and the Progress first load so the multi-second
   `progress-snapshot-load` on a 1-row database can be attributed; the perf
   channel is dev-only and no-ops in release.
5. **Export single pass:** if the two canonicalization passes can be fused
   while keeping the envelope bytes and checksum identical, fuse them; the
   roundtrip and large-backup suites decide.

## Reliability test designs

- A shared persistence-failure contract test for game screens, or a
  `use-game-session` contract test if per-screen behavior is already uniform:
  a rejected save must surface the failure state, keep results visible, and
  not double-write.
- Route failure tests use injected DB/facade failures (existing patterns in
  `data-management.test.tsx` and `storage-unavailable.test.tsx`).
- `math-value-ordering` gets a screen test mirroring the strongest existing
  game screen test (interaction + force-win + persisted exactly-once).
- Where duplicated screen fixtures exist, migrate only the tests touched by
  this campaign onto `src/test-utils` (no mass rewrite).

## Tooling/CI designs

- `validate-workflows.mjs` gains rules: `uses:` must be pinned (full SHA or an
  explicit allowlist entry with rationale), and `continue-on-error: true`
  must be paired with an enforce step in the same job. Self-tests prove
  detection and non-detection.
- Dependency audit gate: `scripts/validate-dependency-audit.mjs` runs
  `npm audit --json --omit=dev` and fails on any production-reachable
  moderate+ advisory; the accepted build/dev advisories are classified in an
  explicit, self-tested allowlist file. Wire into Repository Integrity with
  network-off tolerance (BLOCKED, never silent PASS).
- Pin workflow actions to commit SHAs resolved from the GitHub API (keep the
  original tag in a comment); if the API is unavailable, record the pin as
  deferred with the validator rule still in place.

## Documentation truth design

Update only claims contradicted by code: ADR-0005 (adjacency shipped;
superseding note), ADR-0004 (version pins lifted, note), MASTER_PLAN status,
GAME_SDK phase framing, app README routing, ANDROID_AUTOMATION AVD default,
constitution status line (leave locked decisions untouched), GOAL.md directive
history, KNOWN_ISSUES stale/misclassified entries, BACKLOG synchronization.

## Cleanup design

Remove dead exports proven unreferenced by a whole-repo scan (including
tests); keep anything that is a deliberate public API only if documented as
such. Delete the two unreferenced scripts and the stray tracked log after
confirming no workflow/doc references them. Empty/regenerate the provenance
allowlist using the validator's own semantics (`--generate-allowlist` if it
exists), then prove `--check` stays clean.

## Invariants

- No gameplay/scoring/persistence-format change beyond the explicit repairs;
  every existing testID survives.
- Offline-first boundary, secrets scanning, schema guards and statement-count
  guards stay green; no new dependency.
- QA hooks stay dev-only; reduced motion and 44 dp contracts untouched.
- `main` remains buildable/startable; no force-push; temporary worktrees
  removed.

## Verification

| Claim | Evidence |
|---|---|
| Defects fixed | per-item regression tests that fail on the old behavior |
| Bounded hot paths | statement-count guards + perf probes (opt-in) + code caps |
| Boot work gated | bootstrap test proving repeat boot skips seeding/guards |
| Fail paths handled | route/screen tests that inject the failure |
| Tooling rules work | validator `--self-test` proves detection + non-detection |
| Docs true | claims cross-checked against code at closure |
| No regressions | full Jest matrix + tsc + lint + validators + canaries + workout |
