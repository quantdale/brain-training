## 1. Baseline and provenance

- [x] 1.1 Re-verify clean `main`/`origin/main`, parent task counts, APK identity, and the four workflow run IDs at the starting SHA; correct stale durable notes that still say the evidence SHA lacks remote verification without claiming release acceptance.
- [x] 1.2 Write the game/route provenance table with source commit, APK SHA-256, production dependency, capture identity, visual-review status, applicability, and recapture reason.
- [x] 1.3 Record the source-equivalence diff from `4a6fc53` to the current application source. Classify unchanged game frames as source-equivalent historical evidence, never as terminal-APK captures. List only the frames that require recapture.

## 2. Controller authentication

- [x] 2.1 Run ARTEMIS doctor, then confirm the external credential with one authenticated request and a created task. Do not print, commit, or request the credential.
- [x] 2.2 Run one minimal Flash smoke and one minimal Pro smoke, or record persistent authentication failure, including HTTP 401, and stop controller retries. Doctor READY is not authentication.

## 3. Current-device game acceptance

- [ ] 3.1 On the current release candidate, accept `attention-odd-one-out` active, scored feedback, pause/resume, result, input, and visual states; check parent task 6.1 only with linked evidence.
- [ ] 3.2 Accept `attention-sustained-vigilance` the same way; check parent task 6.2 only with linked evidence.
- [ ] 3.3 Accept `attention-symbol-tracker` the same way; check parent task 6.3 only with linked evidence.
- [ ] 3.4 Accept `attention-visual-search` the same way; check parent task 6.5 only with linked evidence.
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
- [ ] 3.22 Publish the one-row-per-game assessment using only PASS, FIXED, NOT VALIDATED, or justified N/A. Do not count an intro, unanswered board, or filename as scored feedback.

## 4. Defect repair

- [x] 4.1 For each reproduced runtime defect, keep before evidence, apply the minimal fix and regression guard, run focused validation, rebuild and reverify affected states, and update artifact provenance. Record no production edit if none is reproduced.

## 5. Accessibility, layout, and preserved routes

- [ ] 5.1 Preserve the reviewed 90/90 route matrix and two Results-scroll pairs unless a relevant source change invalidates a surface. Recapture only the affected combinations.
- [ ] 5.2 Complete reduced-motion, normal/large viewport, and representative gameplay checks for all eight domains, including actual game-control labels and the Android 48dp floor. Keep occluded or unmeasured nodes out of the pass count.
- [ ] 5.3 Check parent task 14.3 only after every required profile and gameplay condition is satisfied.

## 6. Controller journeys

- [ ] 6.1 After authentication succeeds, execute and inspect first-run, daily workout, scored gameplay, interrupted resume, standalone completion, full workout completion, results and progress, diagnostics or storage recovery, and applicable background/foreground interruption. Record trace ID, APK, planned steps, executed steps, and outcome for each.
- [ ] 6.2 If authentication remains externally blocked, leave parent task 14.4 unchecked with the trace evidence and exact external repair. Do not substitute ADB gameplay.

## 7. Clean checkout and terminal artifact

- [x] 7.1 Run `node scripts/certification/certify-clean-checkout.mjs` without self-test or skip flags from a disposable clean checkout, then remove that checkout. Do not report the self-test as the composite.
- [x] 7.2 Record strict OpenSpec validation and the release APK build as separate results. If the script's OpenSpec pin contradicts the declared CI gate, align the pin and its self-test without lowering thresholds.
- [x] 7.3 Build and install the terminal release APK from the terminal application source. Record source SHA, APK SHA-256, size, version, package, command, toolchain, install result, and device identity.
- [x] 7.4 Confirm the Jest baseline remains 621 passed suites, 4 classified skipped suites, 7,237 passed tests, 5 classified skipped tests, and 5 snapshots, and record the new strict OpenSpec total without forcing the old 60/60 count.

## 8. Ledger, review, and terminal verdict

- [ ] 8.1 Reconcile parent tasks 14.2, 14.7, and 14.8 individually. Check one only when its own evidence exists; name the owner of any BLOCKED_EXTERNAL, NOT VALIDATED, or FAILED task.
- [ ] 8.2 Run read-only review of provenance, accessibility and layout, build and security gates, and parent-task mapping. Repair repository-owned Critical or High findings before acceptance.
- [ ] 8.3 Update `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, and `.agent/EXECUTION_PROMPT.md` so historical checkpoints remain historical and the active closure binding is this change.
- [ ] 8.4 Commit, push `main`, and record App CI, Repository Integrity, Android Build Smoke, and iOS Build Smoke at the exact ending SHA.
- [ ] 8.5 Record exactly one verdict: full validation, repository-complete with named external blockers, or `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`. Missing game or clean-checkout proof forbids repository-complete.
