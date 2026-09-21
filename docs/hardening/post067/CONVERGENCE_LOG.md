# Post-067 hardening — convergence log

## Wave 1 (2026-09-21)

**Recon:** three independent read-only lanes (Pass A static/security,
Pass B runtime/data, Pass C release/UX/a11y), seeded by the 066 residual
census and the 067 terminal ledger, probing beyond them.

**Findings:** 1 High governance blocker (validator state gate), 1 High
product defect (42-screen deep-link exit dead-end), 6 Medium
(import bounds, export heap, focus sync, progress tabs, audit
misclassification, 067 close state), 1 import-bounds DoS, plus Low
items.

**Fixes landed (5 packets + orchestrator):**
1. validator state gate + 067 closure (governance blocker).
2. 42-screen safe-back exit + catalog reintroduction guard.
3. data-path hardening: workout `gameIds` bound, generator/SDK parity,
   `__proto__`-safe canonicalize, typed RangeError, backup-list hygiene,
   `useDbData` key reset, export token coalescing.
4. focus-sync throttle + in-memory dedupe; shared reduced-motion
   subscription; settings persistence outside the state updater.
5. Progress tab 44 dp + radio semantics + grid a11y + audit tool
   occluded classification.

**Verification:**
- Final hardening matrix: 598 suites (594 passed + 4 skipped), 6,933
  passed / 5 classified opt-in skips, 5 snapshots, 0 unexpected console
  output, exit 0 (233.0 s); signal PASS; typecheck/lint 0; OpenSpec
  `--all --strict` 51/51; all validators green.
- Device proofs on the hardening artifact
  `146F63BF…` (109,602,821 bytes): deep link → game → pause → Quit lands
  on Games; fresh Progress capture audits **0 violations**; launch
  1,487 ms with 0 fatal/ANR in the session log.

**Artifact delta:** the 067-certified artifact (`B7AA4102…` from
`a17c019`) predates these fixes; the hardening artifact
(`146F63BF…`) is the current verified build. A future release
certification must re-issue the 067-style matrix on a build from the
hardening tree (recorded as the next certification precondition).

**Residual after wave 1:** zero open Critical/High/Medium defects
(repository-owned). Accepted debt and manual/external boundaries are
listed in `PASS_A/B/C` and the 067 terminal ledger.

## Wave 2 — terminal re-certification (2026-09-21, `POST_067_TERMINAL_RECERTIFICATION_PARTIAL`)

**Recon:** three independent whole-repo passes (R1 invariant attack, R2
historical/test-blindness, R3 production/hostile) + fresh post-fix R4 pass,
executed from the `e444ec3` prompt commit over the post-hardening tree.

**Findings:** 0 Critical/High/Medium open across all four passes. 10 bounded
Low fixes (canonical `clamp01` ×3 + tripwire, single-clock PB guard,
backwards-clock floor, backup-name symmetry, preview-note qualification,
`echoId` truncation ×11 + preview echoes, Score rounding ×6, affected-map
coverage, GameHost intro exit) + `logic-order-path` generatorVersion 1.0.1
(provenance contract) + regenerated registry + 5 fresh probe baselines.
R4 verified 9/9 fixes SOUND with 0 regressions and 0 disposition challenges.

**Verification:** clean full matrix 598 suites (594 passed + 4 skipped) /
6,939 passed + 5 skips / 5 snapshots / 0 unexpected console output; signal
PASS; typecheck/lint 0; Expo Doctor 21/21; OpenSpec 51/51; all validators
green; probes 5/5; web export PASS; `:app:assembleRelease` + `:app:assembleDebug`
exit 0. Final artifact `5FE03134…` (109,604,449 B, bundle `423A8718…`
4,886,112 B, 10/10 + 4 new-tree markers, 8/8 permissions, debug-signed local
release) built from the exact converged tree.

**Residual after wave 2:** zero open repository-owned Critical/High/Medium.
Device lanes on the final artifact (native matrix, workout, SQLite, logs,
provider UI, six-way pixels, device a11y) are NOT VALIDATED — environment-
blocked by a host-kernel KVM BUG (`kvm_spurious_fault` on every vCPU creation,
no GPU/nested-virt; 5 failed boots across two AVDs, emulator 37.1.11).
Per policy the lanes are recorded BLOCKED, never green. The only outstanding
obligation is re-issuing the device matrix on `5FE03134…` from a working
runtime; no source change is needed first.

## Wave 3 — TCG device-evidence push (2026-09-21, still `POST_067_TERMINAL_RECERTIFICATION_PARTIAL`)

**Runtime:** TCG software emulation (`-accel off`) on `braintraining-ui35`
(pixel_7, google_apis x86_64, modern `-gpu swiftshader`); first boot ~17 min,
reboots ~5 min. All automation emulator-local; `study-maker-api35` untouched.

**Validated on exact artifact `5FE03134…`:** clean install + cold launch (no
Metro) + warm + force-stop/relaunch; Home ×3 / Games / Detail / Data-Management
route-verified; deep-link exit fix ×2 (Quit→Home, cold Back-to-games→Games);
live gameplay + pause overlay; export written + listed (14,043 chars);
retention across reboot/force-stop; 60,521-line log review (0 app FATALs, 1
disclosed TCG-induced app ANR). Raw dumps/captures (16, gitignored) under
`qa-artifacts/terminal-recert/device-lanes/`.

**Still NOT VALIDATED:** completion, workout, SQLite rows, import
preview-apply, provider UI, offline/malformed probes, six-way pixels, device
a11y — TCG system ANRs + instrumentation wedges make sustained interaction
(~5–8 min/surface, ~20–30 min stability windows) certification-inviable for
these lanes. Verdict unchanged: PARTIAL with a strictly stronger evidence base.

## Reassessment

A convergence reassessment (source diff review + void scan of the new
fixes against the same lanes) found no new Critical/High/Medium item.
The phase is closed at wave 1; deeper hardening (coverage thresholds,
v12 semantics, backup encryption/fsync, landscape/RTL, 42-game six-way
expansion) remains explicitly seeded for a future owner-authorized cycle.
