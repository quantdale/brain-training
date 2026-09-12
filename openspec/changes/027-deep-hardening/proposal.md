# Proposal — Campaign 027: Deep Hardening

## Why

Campaign 026 closed the visual identity rebuild, leaving a product that is
feature-complete for its current phase and mechanically verified by a strong
unit/integration matrix. A 2026-09-13 forensic audit (four read-only scouts
over the whole repository; synthesis in `audit-map.md`) found no P0 defect but
a stack of P1–P3 correctness, performance, reliability, tooling and
documentation debt that undermines the product as history and complexity grow:

- **Correctness:** one real adaptive-difficulty defect (adaptive sessions
  record the minimum challenge), a stimulus that lingers after the trial
  resolves, dead reducer actions, a non-finite metric serializing as `null`
  behind a `number` type, and a dead difficulty parameter in game provenance.
- **Performance/startup:** unbounded full-history scans on hot UI paths
  (Profile focus, Progress snapshot), a scan cap that is silently bypassed in
  production, ~53 serial seeding upserts plus full DDL guards on every boot,
  and a double canonicalization pass in backup export.
- **Reliability/testing:** only 4 of 41 game screens test the save-failure
  path; rewards, profile purchases, workout-advance failure, storage retry
  success and wipe failure have no route-level coverage; one registered game
  has no screen test at all.
- **Tooling/CI:** the workflow validator checks three shell rules and cannot
  catch unpinned actions or unenforced `continue-on-error`; no dependency
  audit gate exists despite the dependency-audit document claiming triage.
- **Documentation:** ADR-0005 contradicts shipped code; MASTER_PLAN, GAME_SDK,
  the app README, ANDROID_AUTOMATION, ADR-0004, the constitution status line
  and GOAL.md describe an older repository; KNOWN_ISSUES still lists fixed or
  misclassified items.
- **Cleanup:** high-confidence dead exports, two unreferenced scripts, a stray
  tracked log, and an inert provenance allowlist.

The owner explicitly invoked a deep repository-wide hardening campaign. This
campaign is the response: freeze features, repair the real defects, make the
unbounded paths bounded and observable, close the highest-value test gaps,
harden CI/tooling, make documentation true, and remove dead weight.

## What changes

1. **Correctness repairs** (spec `correctness-repairs`): adaptive escalation
   for `spatial-coordinate-turn` with consistent axes and a reached-challenge
   record; immediate stimulus clearing on trial resolution in
   `attention-sustained-vigilance`; dead-action removal in
   `flexibility-color-stroop`; `null`-safe `fastestReactionMs` typing for
   `speed-color-match`; removal/deprecation of the unused `roundTimeMs`
   difficulty budget in `language-word-scramble` (with the required
   provenance version bumps).
2. **Performance and startup** (spec `performance-startup`): bounded/windowed
   quest evaluation and reuse of sync samples so Profile focus does not rescan
   unbounded history; a documented, restoreable samples cap; version-gated
   seeding and schema guards; phase instrumentation on the existing dev-only
   perf channel; single-pass backup export canonicalization if byte-identical
   output is preserved.
3. **Reliability tests** (spec `reliability-tests`): a shared
   persistence-failure contract across game screens; route-level failure tests
   for rewards, profile purchases, workout advance and data-management wipe;
   storage-unavailable retry-success coverage; the missing
   `math-value-ordering` screen test.
4. **Tooling/CI** (spec `tooling-ci`): workflow validator rules for unpinned
   actions and unenforced `continue-on-error`; a dependency-audit gate with an
   explicit self-tested allowlist; pinned workflow actions where obtainable.
5. **Documentation truth** (spec `docs-truth`): supersede the stale ADR-0005
   finding, annotate ADR-0004, update MASTER_PLAN/GAME_SDK/README/
   ANDROID_AUTOMATION/constitution status/GOAL.md, and reconcile
   KNOWN_ISSUES/BACKLOG with reality.
6. **Cleanup** (spec `cleanup-dead-code`): remove high-confidence dead
   exports, unreferenced scripts and the stray tracked log; regenerate the
   inert provenance allowlist.

## Out of scope

New games, new features, new native dependencies, UI redesign, cloud/sync/AI/
monetization (constitution-deferred), dependency-major upgrades, force-push or
history rewrite, manual TalkBack/store-signing/physical-device/iOS evidence
that requires unavailable infrastructure. Game mechanics changes are permitted
only as the correctness repairs above.

## Exit gate

All in-scope work items are completed or explicitly deferred with evidence;
full Jest matrix, `tsc`, `expo lint` and every validator pass; no introduced
Critical/High regression; runtime canaries and the daily-workout journey
remain PASS on the campaign head; docs/state describe reality; meaningful
commits pushed to `main`; remaining work and blockers recorded precisely.
