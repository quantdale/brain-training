# Change 063 — Release-Candidate Runtime Matrix

**Status:** IN_PROGRESS
**Predecessor:** `062-backup-import-export-robustness` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 062–064 release resilience and platform robustness.

## Problem / evidence

Changes 056–062 changed product source (reconcile, route envelope,
provenance, db guards, rating hook, 42 game screens/results, back
navigation, empty/recovery surfaces, tiles, toast, countdown, motion,
focus, db-data, progress throttle, discovery, ledger, cosmetics,
migrations, file transport, data-management copy). The last certified
release APK (`99D1D132`, product checkpoint `34c9b2d`) predates all of
it. No release artifact proves the current tree on device.

Known historical sensitivities to re-probe with bounded repetition
(explicitly NOT assumed fixed or broken):

- First-install ANR (`050` observed once; `054` 30-launch bounded
  non-reproduction).
- Files import provider ANR (technical path closed in 054; human
  usability manual-pending).
- SQLite startup NPE class (repaired 042; regression watch).
- Cold-start after force-stop / offline launch / invalid-route recovery
  (protected contracts — must hold on the new artifact).

## Desired invariant / outcome

- One authoritative release APK built from the exact current tree, with
  recorded SHA-256, size, package/version/signing, Metro independence.
- On the dedicated `braintraining-ui35`/`emulator-5554` runtime: clean
  install + first launch (bounded ANR watch), warm relaunch, offline
  launch, force-stop relaunch, invalid/oversized/malformed route
  recovery, Home/Games/Game Detail/Progress/Profile/Rewards/Data
  route verification, Files picker open + safe cancel, background/
  foreground cycle, representative game completion with persisted
  result, relaunch retention, SQLite integrity/duplicates audit, and a
  clean filtered log review.
- Any reproduced product defect is minimally repaired with a focused
  regression test, followed by rebuild + re-certification (no speculative
  rewrites; no scope creep into 064/065 territory).
- Boundaries stay honest: human TalkBack/VoiceOver, physical/OEM, iOS,
  store signing, human provider usability, external CI remain
  MANUAL/EXTERNAL.

## Non-goals

- No full 42-catalog soak (067), no six-way pixel matrix (067), no new
  features, no redesign, no dependency upgrades, no CI edits.

## Affected areas

`docs/redesign/evidence/campaign063/` (new evidence root following
repo conventions) + defect repairs only if reproduced (unknown files,
orchestrator-owned).

## Protected contracts

All 056–062 behaviors, schema v12 (unless a repair migration is proven
necessary — not anticipated), offline-first, scoring/economy, routing.

## Implementation plan

1. Release build from the exact HEAD (`:app:assembleRelease`),
   record artifact identity + Metro independence.
2. Clean install on the dedicated AVD; first-launch matrix with
   bounded ANR watch (multiple cold launches incl. one true cold boot
   if cheap); warm + offline + force-stop relaunches.
3. Route matrix: Home, Games (+search), Game Detail, Progress,
   Profile, Rewards, Data Management, invalid/oversized/malformed
   recovery; Files picker open + cancel; background/foreground.
4. Representative completion: one short game with real interaction to
   a persisted result (deterministic QA completion is dev-only and
   unavailable in release — use real mechanic play via emulator-local
   input, bounded effort); relaunch retention; SQLite audit
   (integrity, FK, schema, duplicates); filtered log review.
5. Repair loop (only on reproduction): minimal fix + focused test +
   rebuild + re-run affected matrix.
6. Adversarial review of the evidence (no overclaim); durable state;
   commit; push.

## Test plan

- Repository gates already green at 062 close (577/6,847); re-run
  affected suites only for repairs, plus typecheck/lint/OpenSpec.
- Device evidence is captures + hierarchy + SQLite + logcat (recorded,
  not asserted as unit tests).

## Runtime/native evidence plan

This change IS the runtime evidence: ui-capture surfaces, a11y audit
on the matrix, SQLite dump inspection, logcat fatal/ANR scan,
exact-artifact identity. Raw artifacts outside Git per convention
(`D:\Temp\campaign063-*`), curated evidence committed.

## Rollback / risk notes

- A red device finding never blocks unrelated 064+ planning; repair
  loop is bounded to reproduced defects.
- Emulator flakiness (documented host classes) is classified as
  tooling, never as product PASS/FAIL; bounded retries with evidence,
  no blind re-runs.

## Completion criteria

Standard terminal bar + one authoritative APK identity + completed
matrix with honest PASS/NOT VALIDATED per lane + SQLite/log evidence +
adversarial review + pushed + `HEAD == origin/main`.
