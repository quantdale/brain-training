## 1. Baseline and provenance

- [ ] 1.1 Re-verify clean `main`/`origin/main`, parent task counts, APK identity, and the four workflow run IDs at the starting SHA; correct stale durable notes that still say the evidence SHA lacks remote verification without claiming release acceptance.
- [ ] 1.2 Write the game/route provenance table with source commit, APK SHA-256, production dependency, capture identity, visual-review status, applicability, and recapture reason.
- [ ] 1.3 Record the source-equivalence diff from `4a6fc53` to the current application source. Classify unchanged game frames as source-equivalent historical evidence, never as terminal-APK captures. List only the frames that require recapture.

## 2. Controller authentication

- [x] 2.1 Run ARTEMIS doctor, then confirm the external credential with one authenticated request and a created task. Do not print, commit, or request the credential.
- [x] 2.2 Run one minimal Flash smoke and one minimal Pro smoke, or record persistent authentication failure, including HTTP 401, and stop controller retries. Doctor READY is not authentication.

## 3. Current-device game acceptance

- [x] 3.1 On the current release candidate, accept `attention-odd-one-out` active, scored feedback, pause/resume, result, input, and visual states; check parent task 6.1 only with linked evidence.
  **Terminal run (2026-10-10):** PASS on `e243341f…` via ARTEMIS session `cca7832f-43de-4a3a-abee-a4f57470359b`. Board anatomy (3×3 tiles, one deviation), quoted verdicts ("Found it!" with Score 125, and timeout reveal "Time's up"), pause/resume verbatim, result itemised (Score 125, Accuracy 17%, First-try rate 17%, Rounds passed 1/6, Best streak 1, Timeouts 5, XP 12, Reward +12 XP · +2 coins), first-try input responsiveness, and safe exit/re-open all confirmed. Odd-one-out selection mechanic retained. Evidence: `evidence/current-device/attention-odd-one-out/review.md`. Parent task 6.1 checked with this linked evidence.
- [x] 3.2 Accept `attention-sustained-vigilance` the same way; check parent task 6.2 only with linked evidence.
  **Terminal run (2026-10-10):** PASS on `e243341f…` via ARTEMIS session `174c9016-6927-43e6-bd7a-4f62f1d9ddbb`. Verified against the game's own resource-id namespace `attention-sustained-vigilance.*`. Quoted verdicts ("Missed one" with a11y desc "Missed, no tap in time. Blank. Stop number 6."), pause/resume verbatim, result itemised (Score 591, Go hits 1/26, Stop numbers held 4/4, Commissions 0, Mean reaction 862 ms, Best streak 1, XP 25), immediate input, safe exit/re-open. Sustained-timing mechanic retained. **One defect filed (D3):** the GO control's label collapses to ~1.08:1 contrast when disabled — see `evidence/DEFECTS_CURRENT.md`. Parent task 6.2 checked with this linked evidence.
- [x] 3.3 Accept `attention-symbol-tracker` the same way; check parent task 6.3 only with linked evidence.
  **Terminal run (2026-10-10):** PASS on `e243341f…`. Quoted verdicts ("Not quite" / "You found 0 of 2 tracked symbols"), pause/resume with the timer proven frozen, result itemised (Final score 0, Accuracy 0%, Rounds passed 0/5, Best recall 0, Best streak 0, XP 10), immediate input, safe exit/re-open. Tracking mechanic retained. Section 6 files two observations requiring their own reproduction (a transient missing Next-round a11y node on Round 1's reveal, and a duplicate Score chip). Evidence: `evidence/current-device/attention-symbol-tracker/review.md`. Parent task 6.3 checked with this linked evidence.
- [x] 3.4 Accept `attention-visual-search` the same way; check parent task 6.5 only with linked evidence.
  **Terminal run (2026-10-10):** PASS on `e243341f…`. Quoted verdicts ("Round failed" / "Time's up — the odd tile was tile 1"), pause/resume confirmed, result itemised (Score 0, Accuracy 0%, Rounds passed 0/6, Best streak 0, Avg response 0ms, Fastest response —, XP 10, Reward +10 XP · +2 coins, Progress saved), immediate input, safe exit/re-open. Search mechanic retained. Section 6 files two observations (the result screen's Rounds-passed denominator not matching the 12-round session, and the full participation reward granted on a 0%-accuracy all-timeout session). Evidence: `evidence/current-device/attention-visual-search/review.md`. Parent task 6.5 checked with this linked evidence.
- [ ] 3.5 Accept `flexibility-color-stroop` the same way; check parent task 7.2 only with linked evidence.
- [ ] 3.6 Accept `flexibility-task-switch` the same way; check parent task 7.5 only with linked evidence.
- [ ] 3.7 Accept `language-context-fit` the same way; check parent task 8.1 only with linked evidence.
- [ ] 3.8 Accept `language-word-chain` the same way; check parent task 8.3 only with linked evidence.
- [ ] 3.9 Accept `language-word-match` the same way; check parent task 8.4 only with linked evidence.
- [ ] 3.10 Accept `language-word-scramble` the same way; check parent task 8.5 only with linked evidence.
- [ ] 3.11 Accept `logic-code-cracker` the same way; check parent task 9.1 only with linked evidence.
- [ ] 3.12 Accept `math-equation-builder` the same way; check parent task 10.1 only with linked evidence.
- [ ] 3.13 Accept `math-fast-math` the same way; check parent task 10.2 only with linked evidence.
- [ ] 3.14 Accept `math-number-line-estimation` the same way; check parent task 10.4 only with linked evidence.
- [ ] 3.15 Accept `math-value-ordering` the same way; check parent task 10.5 only with linked evidence.
- [ ] 3.16 Accept `memory-prospective-cue` the same way; check parent task 11.5 only with linked evidence.
- [ ] 3.17 Accept `memory-running-order` the same way; check parent task 11.6 only with linked evidence.
- [ ] 3.18 Accept `spatial-grid-nav` the same way; check parent task 12.3 only with linked evidence.
- [ ] 3.19 Accept `speed-quick-compare` the same way; check parent task 13.3 only with linked evidence.
- [ ] 3.20 Accept `speed-tap-rush` the same way; check parent task 13.5 only with linked evidence.
- [ ] 3.21 Add current-device rows for the 22 games whose parent redesign tasks are already checked, without treating those existing checks as this review.
- [x] 3.22 Publish the one-row-per-game assessment using only PASS, FIXED, NOT VALIDATED, or justified N/A. Do not count an intro, unanswered board, or filename as scored feedback.
  **Terminal run (2026-10-10):** `evidence/assessment.json` published with one row per registered game and only the four permitted values: **PASS 4** (`attention-odd-one-out`, `attention-sustained-vigilance`, `attention-symbol-tracker`, `attention-visual-search`), **NOT VALIDATED 38**. Generated by `node scripts/certification/build-assessment.mjs`, which fails closed: a row is PASS only when its review.md names the terminal APK, quotes a scored verdict, fills every required section, and carries a reviewer verdict whose identity is verified. The 38 NOT VALIDATED rows are honest — no intro screen, unanswered board or filename was counted as scored feedback for any of them.

## 4. Defect repair

- [ ] 4.1 For each reproduced runtime defect, keep before evidence, apply the minimal fix and regression guard, run focused validation, rebuild and reverify affected states, and update artifact provenance. Record no production edit if none is reproduced.

## 5. Accessibility, layout, and preserved routes

- [x] 5.1 Preserve the reviewed 90/90 route matrix and two Results-scroll pairs unless a relevant source change invalidates a surface. Recapture only the affected combinations.
- [ ] 5.2 Complete reduced-motion, normal/large viewport, and representative gameplay checks for all eight domains, including actual game-control labels and the Android 48dp floor. Keep occluded or unmeasured nodes out of the pass count.
- [ ] 5.3 Check parent task 14.3 only after every required profile and gameplay condition is satisfied.

## 6. Controller journeys

- [ ] 6.1 After authentication succeeds, execute and inspect first-run, daily workout, scored gameplay, interrupted resume, standalone completion, full workout completion, results and progress, diagnostics or storage recovery, and applicable background/foreground interruption. Record trace ID, APK, planned steps, executed steps, and outcome for each.
- [ ] 6.2 If authentication remains externally blocked, leave parent task 14.4 unchecked with the trace evidence and exact external repair. Do not substitute ADB gameplay.

## 7. Clean checkout and terminal artifact

- [x] 7.1 Run `node scripts/certification/certify-clean-checkout.mjs` without self-test or skip flags from a disposable clean checkout, then remove that checkout. Do not report the self-test as the composite.
  **Terminal run (2026-10-09):** PASS 20/20 at `690fb22` from a disposable clone, no skip flags, checkout removed. Includes the §6.1 alignment so the Expo step is the declared hermetic gate. See `evidence/GATES.md` §7.1.
- [x] 7.2 Record strict OpenSpec validation and the release APK build as separate results. If the script's OpenSpec pin contradicts the declared CI gate, align the pin and its self-test without lowering thresholds.
- [x] 7.3 Build and install the terminal release APK from the terminal application source. Record source SHA, APK SHA-256, size, version, package, command, toolchain, install result, and device identity.
  **Terminal run (2026-10-10):** `apps/mobile` has not changed since terminal source `b293a02`, so the previously built release APK is still the terminal artifact and no rebuild was required. Installed with `adb -s emulator-5570 install -r` on the recovered dedicated AVD `braintraining-ui35` (Android 15, SDK 35). Package `com.braintraining.app`, `versionCode=1000`, `versionName=0.1.0`, `minSdk=24`, `targetSdk=36`, ABI x86_64, 48,888,452 B. The installed `base.apk` was pulled off the device and hashed: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` — an exact match to the host release APK. Cold launch verified (`LaunchState: COLD`, `TotalTime: 2399`, `MainActivity` held focus, 0 ANRs). See `evidence/DEVICE_RECOVERY.md` and the `deviceVerification` field of `evidence/TERMINAL_IDENTITY.json`.
- [x] 7.4 Confirm the Jest baseline remains 621 passed suites, 4 classified skipped suites, 7,237 passed tests, 5 classified skipped tests, and 5 snapshots, and record the new strict OpenSpec total without forcing the old 60/60 count.
  **Terminal run (2026-10-09):** 622 passed / 4 skipped suites, 7,241 passed / 5 skipped tests, 5 snapshots — the old baseline did **not** drop; the movement is the two additive regression guards. Strict OpenSpec 61/61. See `evidence/GATES.md` §7.4.

## 8. Ledger, review, and terminal verdict

- [ ] 8.1 Reconcile parent tasks 14.2, 14.7, and 14.8 individually. Check one only when its own evidence exists; name the owner of any BLOCKED_EXTERNAL, NOT VALIDATED, or FAILED task.
- [ ] 8.2 Run read-only review of provenance, accessibility and layout, build and security gates, and parent-task mapping. Repair repository-owned Critical or High findings before acceptance.
- [ ] 8.3 Update `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, and `.agent/EXECUTION_PROMPT.md` so historical checkpoints remain historical and the active closure binding is this change.
- [ ] 8.4 Commit, push `main`, and record App CI, Repository Integrity, Android Build Smoke, and iOS Build Smoke at the exact ending SHA.
- [ ] 8.5 Record exactly one verdict: full validation, repository-complete with named external blockers, or `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`. Missing game or clean-checkout proof forbids repository-complete.
