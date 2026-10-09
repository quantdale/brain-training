# Campaign 076-F — Evidence Reconciliation and Terminal Closure

**Status:** READY FOR EXECUTION
**Repository:** `quantdale/brain-training`
**Change:** `076-f-final-product-certification`
**Parent ledger:** `openspec/changes/076-product-wide-ui-ux-reboot/tasks.md`
**Do not open Change 077. Do not start a redesign.**
**Prompt authored against:** `05bf79387fe4099f1e0e119dbc14ff7e16c0622b`
**Verdict to preserve until the exit gate:** `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`

Paste this into a fresh session:

```text
Execute .agent/CAMPAIGN076F_EVIDENCE_RECONCILIATION_AND_TERMINAL_CLOSURE_PROMPT.md completely. Day mode unless this message explicitly says night. Do not execute the historical 076 redesign waves. Resolve every finding in this prompt, finish the remaining certification, and stop only on the single honest terminal verdict.
```

This file is the execution authority for that session. `.agent/EXECUTION_PROMPT.md` below its closure banner is historical. `evidence/VERDICT.md`, `evidence/REPORT.md`, `.agent/STATE.md`, and `.agent/GATES` claims are not current truth until you reconcile them. Chat memory is not evidence.

---

## 0. Mission

Finish Campaign 076. Two obligations, in this order:

1. Repair the false ledger, stale provenance, and contradictory control documents found by the 2026-10-09 apply review.
2. Complete every remaining repository-owned acceptance gate on one terminal APK, then publish exactly one verdict.

Training Studio stays locked. Do not change scoring, persistence, economy, workout ownership, offline behavior, or registry semantics. Production edits are allowed only for a defect you reproduce on the current terminal APK, with a regression guard and impact-based recertification.

Day mode unless the invoking message explicitly selects night. One dedicated emulator. No host mouse, host keyboard, or desktop-focus automation. ARTEMIS at `D:\Tools\artemis` is the only gameplay and journey driver. ADB may install, log, screenshot, and dump hierarchy. ADB must not drive gameplay or be reported as a Pro journey.

Never print, request, or commit a credential, `.env`, or raw provider trace.

---

## 1. Startup

1. Read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/GOVERNANCE.json`, this file, the 076-f `proposal.md`, `design.md`, `specs/terminal-product-certification/spec.md`, and `tasks.md`.
2. Read parent `tasks.md` and these evidence files before trusting any summary: `REPORT.md`, `VERDICT.md`, `GATES.md`, `DEFECTS.md`, `SOURCE_EQUIVALENCE.md`, `ASSESSMENT.md`, `assessment.json`, `CONTROLLER.md`, `ROUTES_AND_A11Y.md`, `.agent/STATE.md`.
3. `git fetch`, confirm `main` equals `origin/main`, and record the actual HEAD. Pull if this prompt is not yet on the branch you execute.
4. Run `node scripts/validate-repo-state.mjs`.
5. Re-verify GitHub Actions at the SHA you actually start from. As of prompt authoring, `05bf793` later completed green: App CI `37911994644`, Repository Integrity `37911994762`, Android Build Smoke `37911994775`, iOS Build Smoke `37911994528`. That fact is a starting checkpoint only. Do not cite it as the ending SHA after you commit.

If any named fact in this prompt disagrees with the repository, record the new truth and continue. Do not preserve a false checkbox to match this prompt.

---

## 2. Known false claims you must clear first

Do this before another game sweep. A sweep filed on top of these checks will repeat the failure this certification exists to catch.

### 2.1 Uncheck tasks whose evidence no longer satisfies them

The supersede commit `b7cf09b` marked previously accepted game rows `SUPERSEDED-BY-APK-CHANGE` and `NOT VALIDATED` on `de6c5fcd…`, then did not touch the ledgers. These boxes are still checked and must be unchecked in the same commit that records why:

076-f `tasks.md`:

- `1.1`, `1.2`, `1.3` — baseline and provenance were not regenerated after `session-header.tsx` and `button.tsx` changed.
- `3.1`, `3.3`, `3.4`, `3.22` — acceptance or the published table is not terminal-APK proof. `3.2` is already open; leave it open.
- `4.1` — the code fixes may stand, but the required provenance update was not done. Do not revert the fixes. Uncheck until provenance matches the tree.
- `6.2` — its condition is "if authentication remains externally blocked". Flash and Pro smokes were later recorded as pass. A checked `6.2` falsely says the blocked-auth branch is current. Keep the historical 401 evidence labeled historical. Leave `6.1` open.
- `7.1`, `7.3`, `7.4` — the composite and Jest/APK identity in `GATES.md` describe `a45232f` / `c324960` / `de6c5fcd…` / 621 suites, not the post-fix tree. `7.2` may stay checked only if you re-verify the OpenSpec pin is still `@fission-ai/openspec@1.9.0 validate --all --strict` and the self-test still guards that pin.
- `8.1`, `8.2`, `8.3`, `8.4`, `8.5` — they claim current reconciliation, review, durable state, ending-SHA CI, and the terminal verdict. The October review happened and its seven findings were repaired; it is not a review of HEAD. Uncheck these until the exit gate.

Parent `tasks.md`:

- Uncheck `6.1`, `6.3`, and `6.5`. Their rows in `ASSESSMENT.md` are `NOT VALIDATED` and say they are not terminal-candidate evidence.
- Do not check or uncheck any other parent task in this repair commit.
- `14.8` may stay checked only as a historical checkpoint. It is not proof that durable state is current. You will update those files again at the exit gate.

Do not bulk-check anything in this commit.

### 2.2 Make provenance able to tell the truth

Current `scripts/certification/build-provenance.mjs` hardcodes:

- `TERMINAL_APK` = `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- `TERMINAL_SOURCE` = `c324960c7619d305f01d60587f9e74c4ca93ca6a`

Those are the route-evidence identities, not the post-fix candidate `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` from `b293a02`. The non-test production diff `4a6fc53..HEAD` includes:

- `apps/mobile/src/app/(tabs)/index.tsx`
- `apps/mobile/src/app/progress-detail.tsx`
- `apps/mobile/src/components/game-ui/session-header.tsx`
- `apps/mobile/src/components/ui/button.tsx`

`session-header.tsx` is already inside the script's dependency surface. `button.tsx` is not. Add `apps/mobile/src/components/ui` to that surface. Shared button hit-testing is shared gameplay presentation.

Required generator behavior:

- Fail closed if any row would be labeled `SOURCE_EQUIVALENT_HISTORICAL` while its dependency closure changed.
- Still emit a table. Changed game frames are not equivalent and are not captures from the terminal APK. Record `currentApplicability: false` and `recaptureRequired: true`. Do not relabel them as the terminal APK.
- Route rows stay bound to the APK that produced them. `de6c5fcd…` route rows are not `CURRENT_APK` for `e243341f…` unless you rebuild and the hash matches, or you recapture them.
- `assessment.json` `apk` must be the APK the rows were graded on, not a stale hardcoded hash.
- Do not hand-edit the 302 rows. Regenerate them.
- Do not weaken the fail-closed check to make the script exit 0.

Update `SOURCE_EQUIVALENCE.md` so it no longer says the closure has zero files. Update the spec only if the generator needs a named non-equivalent state the current three classes cannot express. Do not use that edit to loosen acceptance.

### 2.3 One identity, one current narrative

These documents currently disagree. After the repair commit, each must identify historical text as historical, and the current block must agree:

| Document | Stale claim to stop presenting as current |
| --- | --- |
| `VERDICT.md` | terminal APK `de6c5fcd…`, no production edit, 5 PASS / 37 NOT VALIDATED, Jest 621 / 7,237, reduced motion not validated, 0 closure changes |
| `GATES.md` | terminal source `c324960`, APK `de6c5fcd…`, Jest exact 621 match, as the current terminal identity |
| `DEFECTS.md` | the later section that says the tree is untouched and lists only `index.tsx` and `progress-detail.tsx` |
| `REPORT.md` | 0 closure changes; task list that says `3.1–3.4` are complete and omits open `3.2` |
| `.agent/STATE.md` | closure unchanged, byte-identical `de6c5fcd…`, Jest 621, current blocker is Google free-tier quota |
| `.agent/EXECUTION_PROMPT.md` | quota-only correction as the latest controller fact |

The controller fact, if still true when you re-probe, is: authentication was restored by an owner-directed move to the external OpenDesign endpoint; object detection remains on the required Gemini ER model; credentials stay only in `D:\Tools\artemis\.env`. Do not copy that endpoint configuration into Git if it would contain a secret. Do not switch provider again unless authentication fails and the owner has already selected the replacement. Do not revert to the Google free tier.

`REPORT.md` section 12 must list the real checkbox state after the uncheck commit. "42 current-device rows" is not acceptance. Say 42 assessment slots, 0 accepted on the terminal APK, until the sweep proves otherwise.

Reduced-motion captures in `evidence/reduced-motion/captures.json` are bound to `de6c5fcd…`. They may remain evidence for that APK's route surfaces. They do not certify `e243341f…` and they do not close task `5.2`. `game-intro` in that set uses `Button`, not `SessionHeader`. Verify whether any preserved route surface renders `SessionHeader`. If one does, recapture only that surface on the terminal APK. If none does, keep task `5.1` checked and write that impact note. The 4dp hit slop does not by itself invalidate pixel stills or already-measured 48dp bounds.

Leave the Expo Doctor mismatch recorded until section 6. Do not call the `a45232f` composite a certification of the terminal tree.

Commit this reconciliation before device work. Push `main`.

---

## 3. Establish the terminal application artifact

After the reconciliation commit, the terminal application SHA is the latest commit that changes app or build inputs. Evidence-only commits do not require a rebuild.

Rebuild with the existing canonical x86_64 release command from that tree. Install on the one dedicated emulator. Pull `base.apk` and hash it. Record source SHA, APK SHA-256, size, version name and code, package id, command, Gradle/JVM/Node, install result, and device identity.

If the hash matches `e243341f…`, that match is evidence. If it does not, the new hash is the terminal APK and every game row graded on another hash stays `NOT VALIDATED`. Do not assume reproducibility.

The route matrix on `de6c5fcd…` remains prior-APK visual evidence. Do not regenerate all 90 routes unless section 2.3 found an affected surface.

---

## 4. Finish 42-game acceptance on that APK

This is repository-owned. Controller failure does not make it external and does not authorize repository-complete.

Re-probe ARTEMIS before the sweep: doctor, one authenticated request, one minimal Flash smoke, one minimal Pro smoke. Doctor READY is not authentication. If HTTP 401 or another auth failure persists, stop controller retries, record the exact external repair, finish every independent gate in this prompt, and keep the blocked verdict. Do not play the 42 games through ADB.

If auth works, accept every registered game on the terminal APK. A historical note, a superseded `de6c5fcd…` row, a filename, an intro, or an unanswered board is not acceptance. Scored feedback requires a quoted scored or timeout verdict visible in an inspected frame from this APK. The on-screen title must match the requested game before play. Force-stop and cold-launch before each deep link. Do not let the harvester attribute a session by game name, write a skeleton as a review, or overwrite a PASS/FIXED row.

For each game record active, feedback, pause/resume, result, input, and visual status as `PASS`, `FIXED`, `NOT VALIDATED`, or justified `N/A`. Then check the matching 076-f task and parent task only in the same commit as the linked evidence.

Unchecked 076-f tasks and parent ids:

| 076-f | Parent | Game |
| --- | --- | --- |
| 3.1 | 6.1 | `attention-odd-one-out` |
| 3.2 | 6.2 | `attention-sustained-vigilance` |
| 3.3 | 6.3 | `attention-symbol-tracker` |
| 3.4 | 6.5 | `attention-visual-search` |
| 3.5 | 7.2 | `flexibility-color-stroop` |
| 3.6 | 7.5 | `flexibility-task-switch` |
| 3.7 | 8.1 | `language-context-fit` |
| 3.8 | 8.3 | `language-word-chain` |
| 3.9 | 8.4 | `language-word-match` |
| 3.10 | 8.5 | `language-word-scramble` |
| 3.11 | 9.1 | `logic-code-cracker` |
| 3.12 | 10.1 | `math-equation-builder` |
| 3.13 | 10.2 | `math-fast-math` |
| 3.14 | 10.4 | `math-number-line-estimation` |
| 3.15 | 10.5 | `math-value-ordering` |
| 3.16 | 11.5 | `memory-prospective-cue` |
| 3.17 | 11.6 | `memory-running-order` |
| 3.18 | 12.3 | `spatial-grid-nav` |
| 3.19 | 13.3 | `speed-quick-compare` |
| 3.20 | 13.5 | `speed-tap-rush` |

Task `3.21` is the other 22 games. Their existing parent checks are not this review. Do not uncheck those parent redesign tasks unless you prove the earlier check was false. Do add a current-terminal-APK row for each:

`attention-target-count`, `flexibility-card-sort`, `flexibility-cue-shift`, `flexibility-rule-flip`, `language-sentence-builder`, `logic-deduction-table`, `logic-next-sequence`, `logic-order-path`, `logic-rule-grid`, `math-missing-operator`, `memory`, `memory-grid-recall`, `memory-pair-recall`, `memory-pattern-tap-back`, `memory-sequence-memory`, `spatial-coordinate-turn`, `spatial-fold-match`, `spatial-mental-rotation`, `spatial-transform-match`, `speed-color-match`, `speed-order-sweep`, `speed-reaction-time`.

Check `3.22` only when the published table is the terminal-APK table and every row has been observed or explicitly left `NOT VALIDATED` with a named blocker. A placeholder that says "no current-device row yet" means `3.21` and `3.22` are not done.

If you reproduce a new defect: before evidence, minimal fix, regression guard, focused tests, rebuild, re-verify only the affected surfaces, regenerate provenance, and move the terminal APK identity. Do not keep old PASS rows for an affected surface.

Commit and push after each domain wave or other recoverable checkpoint.

---

## 5. Finish accessibility and the nine journeys

Task `5.2` stays open until representative gameplay from all eight domains is reviewed on the terminal APK, including actual game-control labels and the Android 48dp floor. Occluded, unmeasured, and provider-limited nodes stay outside the pass count. A zero-violation route audit does not certify game controls. Reduced-motion evidence on `de6c5fcd…` does not close this task.

Check parent `14.3` and 076-f `5.3` only when every condition in `5.2` is satisfied on the terminal artifact.

Task `6.1` is the live journey task. Execute and inspect, through ARTEMIS Pro, all nine:

1. First-run onboarding.
2. Daily workout launch.
3. Active gameplay with scored feedback.
4. Interrupted workout and resume.
5. Standalone game completion.
6. Full workout completion.
7. Results and progress reflection.
8. Diagnostics or storage recovery.
9. Background/foreground interruption where the product supports it.

For each, record controller session, trace id, terminal APK SHA, planned steps, executed steps, screenshot identity, observed outcome, and `PASS`, `FAIL`, or `BLOCKED`. A successful RPC with no executed journey is not `PASS`. Inspect the trace. Do not copy raw traces into Git.

Check parent `14.4` only when those journeys have been inspected and Critical/High product defects from them are fixed and reverified. If the controller is externally blocked, leave `14.4` and `6.1` unchecked and name the owner.

---

## 6. Terminal repository gates

After the last permitted source fix:

1. Align `scripts/certification/certify-clean-checkout.mjs` with the declared gate if it still hard-fails on network `expo-doctor` while CI classifies that failure as upstream drift. Run the hermetic `validate-expo-alignment.mjs` gate in the composite instead. Do not lower Jest, audit, or OpenSpec thresholds. Extend the self-test so the script cannot drift back to `@fission-ai/openspec@1.6.0` or to a non-strict validate. The `a45232f` 19/20 result stays historical.
2. Run `node scripts/certification/certify-clean-checkout.mjs` with no `--self-test`, `--skip-install`, or `--allow-jest-not-validated`, from a disposable clean checkout of the terminal SHA. Remove that checkout even on failure. Record the script's own result. A self-test pass is not the composite.
3. Separately record strict OpenSpec `npx --yes @fission-ai/openspec@1.9.0 validate --all --strict`. The item count may exceed 61. Do not delete this change to preserve 60 or 61.
4. Record the release APK build as its own result. The composite does not assemble an APK.
5. Record the actual Jest totals. The old 621 / 7,237 baseline must not drop. Additive guard suites may raise it. No new unclassified skip, no disabled test, no retry hiding a failure.
6. Re-run `node scripts/certification/build-provenance.mjs` at the terminal SHA. Commit the generated table only if it does not label a changed closure as source-equivalent.

Check `7.1`, `7.3`, and `7.4` only against this terminal run.

---

## 7. Exit gate

Run one new read-only review after the sweep and the terminal gates. Reviewers must not edit production files. Cover at least:

- no checked 076-f or parent task whose cited evidence is from another APK or a superseded row
- provenance generator output versus `git diff 4a6fc53..HEAD`
- `VERDICT.md`, `REPORT.md`, `GATES.md`, `DEFECTS.md`, `ASSESSMENT.md`, `assessment.json`, and `.agent/STATE.md` name the same terminal source SHA and APK SHA
- `6.2` is not the live disposition if authentication succeeded
- route-matrix claims do not call `de6c5fcd…` frames captures of the terminal APK
- no credential or raw trace in Git

Repair every repository-owned Critical or High finding before the verdict. Then update `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, and `.agent/EXECUTION_PROMPT.md`. Historical checkpoints remain, clearly marked historical.

Commit, push `main`, and wait for App CI, Repository Integrity, Android Build Smoke, and iOS Build Smoke at that exact ending SHA. Record run ids and conclusions. Green runs at `05bf793` or `b7cf09b` are not that evidence. If an evidence-only ending commit fails a gate, repair it and wait again. Do not force-push.

Check `8.1` through `8.5` only after that wait. Parent `14.2` and `14.7` close only when the 42-game table, route/APK manifest, reference-lock pointer, and explicit gaps are published. Parent `14.8` may be updated again in the exit commit; do not treat the earlier check as this exit.

### Verdict

Use exactly one:

- `CHANGE_076_PRODUCT_WIDE_UI_UX_REBOOT_VALIDATED` only if every mandatory gate passed, including the nine inspected journeys and applicable platform gates. iOS runtime is not validated without a macOS runtime run. Android evidence cannot create an iOS pass. If iOS runtime is still not validated, this verdict is forbidden.
- `CHANGE_076_REPO_COMPLETE_RELEASE_ACCEPTANCE_BLOCKED_EXTERNAL` only if every repository-owned gate actually passed, including all 42 terminal-APK game rows, and every remaining gap is external. iOS runtime may be that gap. An unrepaired controller may be that gap only for journeys that were not run. Missing game rows forbid this verdict.
- `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` if any repository-owned game, accessibility, provenance, or clean-checkout proof is still missing, or if a required gate failed.

Do not announce success after a plan, a ledger edit, or a partial sweep.

---

## 8. Forbidden

- Change 077, a new visual direction, or reopening the reference lock without a reproduced defect.
- Checking a parent or 076-f task without linked evidence in the same commit.
- Calling a skeleton, wrong-game frame, intro, unanswered board, or filename scored feedback.
- Labeling `de6c5fcd…` or `b2913bca…` frames as the terminal APK.
- Leaving `SOURCE_EQUIVALENT_HISTORICAL` on frames whose closure includes `session-header.tsx` or `button.tsx`.
- Substituting ADB gameplay for ARTEMIS.
- Infinite 401 retries, printing tokens, or committing `.env` or raw traces.
- Citing `05bf793` workflow runs as the ending-SHA result.
- A second Android emulator, host input injection, or a gameplay driver under `scripts/android/`.
- Lowering Jest, audit, coverage, or OpenSpec thresholds to go green.
- Force-pushing `main`.

---

## 9. Required final report

Return only what you verified:

- starting SHA, ending SHA, `origin/main`, worktree
- tasks unchecked at start, tasks checked at end, parent tasks checked or still open
- terminal source SHA, APK SHA-256, size, package, device hash match
- provenance: closure files, row classes, generator exit
- games: 42-row counts by status, all on the terminal APK or not
- journeys: trace ids and classification
- accessibility: what was measured on which APK
- clean-checkout: command, SHA, result, and what the script does not cover
- four workflow run ids at the ending SHA
- the one verdict and the unmet gates, if any
