## Context

See `proposal.md` for why this certification exists. Parent change `076-product-wide-ui-ux-reboot` remains the redesign contract and the acceptance ledger. At explore time, `main` and `origin/main` were clean at `7e7374bda649e1d6fa79cccb44dff255cba862da`. That commit is evidence and control-plane only relative to application source `c324960c7619d305f01d60587f9e74c4ca93ca6a`.

Measured baseline, which apply must re-verify rather than inherit from chat:

- Parent tasks: 57/82 checked, 25 unchecked. The 25 are 20 game-domain tasks in sections 6–13 plus `14.2`, `14.3`, `14.4`, `14.7`, and `14.8`. `14.5` and `14.6` are already checked and are not reopened without a contradiction.
- Route evidence: 90/90 reviewed pairs plus two Results-scroll pairs on APK `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, `com.braintraining.app` 0.1.0/1000). Six filed audits reported zero violations, with 32 occluded nodes excluded as unmeasurable.
- Historical game index: A/F/P/R = 42/42 on mixed builds plus 22 closure frames from APK `b2913bca9149eee752704b2529a1ddf13c877b26290b5d576d1be42355fe5d31` at source `4a6fc53`. Those frames are not terminal-APK captures.
- Production diff `4a6fc53..7e7374b`: Home workout-progress styling, Progress-detail badge wrapping, their tests, and a Task Switch HUD display assertion. No game board, game host, theme token, native manifest, or navigation file changed in that range. This is a hypothesis for source equivalence, not a filed provenance table.
- Workflows at `7e7374b` were green: App CI `37719414181`, Repository Integrity `37719414125`, Android Build Smoke `37719414141`, iOS Build Smoke `37719414138`. Durable notes that still say the evidence SHA needs its own remote check are stale relative to those runs.
- ARTEMIS Pro `cecc4f2a-ae03-4868-a074-adf533e12a61` failed HTTP 401 with no steps. Flash `043dea1e-34df-4fcd-a38a-8dffa432176c` terminated without usable steps. iOS compile passed; iOS runtime is not validated.
- `scripts/certification/certify-clean-checkout.mjs --self-test` is not the composite. The composite does not assemble an APK, and its OpenSpec step is pinned to `@fission-ai/openspec@1.6.0 validate --all`, not the governance pin `@fission-ai/openspec@1.9.0 validate --all --strict`.

Execution mode is day unless the owner explicitly selects night. One dedicated emulator. No host mouse or keyboard injection.

## Goals / Non-Goals

**Goals:**

- Produce one provenance table, one 42-row current-device assessment, and one terminal artifact identity.
- Close each unchecked parent task only from linked evidence.
- Leave a recoverable blocked checkpoint if the controller credential cannot be repaired.

**Non-Goals:**

- A new visual direction, Change 077, or a second gameplay driver under `scripts/android/`.
- Repeating the 90-route matrix when its dependencies are unchanged.
- Treating doctor READY, a controller RPC success, or a filename as journey or feedback acceptance.
- Expanding clean-checkout into device QA.

## Decisions

### 1. Add a sibling certification change; do not rewrite 076 planning

This change holds the closure rules and procedure. Parent `tasks.md` remains the product-acceptance ledger. Apply may check a parent box only in the same commit that links the satisfying evidence.

Alternative considered: edit 076's proposal, design, and specs in place. Rejected because those artifacts describe the completed redesign, and mixing closure rules into them would look like a new design pass. Alternative considered: number this Change 077. Rejected by the owner prompt.

### 2. Classify evidence before recapturing it

Apply builds the provenance table before launching capture work. Allowed classes are `CURRENT_APK`, `SOURCE_EQUIVALENT_HISTORICAL`, and `NOT_APPLICABLE`, plus an explicit recapture reason. Source equivalence requires a recorded diff of game boards, game host, shared gameplay components, theme tokens, game rendering, game navigation, native configuration, and common runtime behavior. The `4a6fc53..7e7374b` diff above supports equivalence only until the next production edit; any later fix restarts the affected comparison.

A source-equivalent frame may justify not repeating a screenshot, but section 4 of the owner prompt still requires a current-device check. The check observes the installed terminal candidate. It does not need a new filed frame unless the check disagrees with the historical frame, equivalence fails, or the parent task text requires a capture that the existing file does not satisfy.

Alternative considered: discard every pre-`de6c5fcd` frame. Rejected because the owner prompt forbids redundant work and the measured rendering delta is outside game boards. Alternative considered: accept historical frames as terminal-APK proof. Rejected because that is the failure mode that reopened 076.

### 3. Controller failure does not create repository-complete

ARTEMIS at `D:\Tools\artemis` is the only gameplay and journey driver. Apply runs doctor, confirms the external credential with a real authenticated request without printing it, then runs one minimal Flash smoke and one minimal Pro smoke before the required journeys. ADB may install, log, screenshot, and inspect hierarchy. It must not drive gameplay or be reported as Pro.

If HTTP 401 or another auth failure persists after that bounded probe, stop controller retries. Continue provenance, local gates, clean-checkout, and evidence reconciliation. Leave game rows and task `14.4` unaccepted. The verdict remains `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` because game acceptance is repository-owned work that has not been observed. Do not promote that state to `CHANGE_076_REPO_COMPLETE_RELEASE_ACCEPTANCE_BLOCKED_EXTERNAL`. Repository-complete is available only after the 42 current-device rows and the other repository-owned gates have actually passed, with only external residuals such as an unrepaired controller journey lane or iOS runtime still open.

Alternative considered: call repository-complete as soon as the credential is the only blocker. Rejected because the owner prompt explicitly keeps missing game proof out of that verdict. Alternative considered: play the 42 games through ADB. Rejected by the parent design and this change's spec.

### 4. Split clean-checkout truth from adjacent gates

Run `node scripts/certification/certify-clean-checkout.mjs` with no `--self-test`, `--skip-install`, or `--allow-jest-not-validated`, from a disposable clean checkout that does not contain inherited `apps/mobile/android` or `apps/mobile/ios`. Remove that checkout afterward. Record the script's own PASS or FAIL.

Separately run governance strict OpenSpec validation and the existing release APK build. Their results do not inherit the script result, and the script result does not inherit theirs. If apply finds the script's OpenSpec pin contradicts the declared CI gate, align that pin with the existing governance command and its self-test; do not lower Jest, audit, or OpenSpec thresholds. Do not add device control to the script.

The preserved test baseline is 621 passed suites, 4 classified skipped suites, 7,237 passed tests, 5 classified skipped tests, and 5 snapshots. Adding this change increases the strict OpenSpec item count above 60/60. Record the new total. Do not delete the change to preserve the old number.

### 5. Separate application SHA from evidence SHA

The terminal application SHA is the latest commit that changes app or build inputs. Evidence-only commits do not by themselves require a new APK. After the last permitted fix, build the release APK from that tree with the existing canonical x86_64 release command, install it, and record source SHA, APK SHA-256, size, version code and name, package id, command, toolchain, install result, and device identity. If no application input changed after `c324960`, a rebuilt hash may match `de6c5fcd…`; a match is evidence, not an assumption. Claims must name the artifact that supports them.

### 6. Review, then push the ending SHA

Before the terminal verdict, run read-only review over provenance, accessibility and layout, build and security gates, and parent-task mapping. Reviewers do not edit production files. Repair repository-owned Critical or High findings before acceptance. Then commit, push `main`, and wait for App CI, Repository Integrity, Android Build Smoke, and iOS Build Smoke at that exact ending SHA. Green runs at `7e7374b` are baseline only.

Durable `.agent/` files and `.agent/EXECUTION_PROMPT.md` are updated at apply checkpoints so they stop citing `c324960` as the latest remote-verification boundary. This planning pass does not mark the parent execution prompt complete.

## Risks / Trade-offs

- [Controller credential stays invalid] → Finish independent proof, record the exact external repair, and keep the blocked verdict. Do not retry 401 in a loop or switch provider.
- [Source equivalence is overturned by a small shared fix] → Recapture only the affected dependency closure and preserve unrelated hashes.
- [Clean-checkout is expensive and can mutate a live tree] → Run it only in a disposable checkout and delete that checkout even on failure.
- [Strict OpenSpec count changes] → Explain the added change in validation records instead of treating the new count as a regression or forcing 60.
- [Historical state files contradict evidence] → Repository files and GitHub run metadata outrank older checkpoint prose. Reconcile the prose; do not delete historical checkpoints.
- [Credential or trace leakage] → Keep provider configuration and raw traces under the external ARTEMIS directory. Commit scrubbed IDs only.

## Migration Plan

1. Re-verify the baseline and write the provenance table without production edits.
2. Probe ARTEMIS authentication once. If it succeeds, perform current-device game checks and the required journeys. If it fails, record the blocker and continue independent gates.
3. Repair only reproduced defects, then rebuild and recertify the affected surfaces.
4. Run the clean-checkout composite and the separate strict-OpenSpec and APK identity gates.
5. Reconcile parent tasks one by one, run the read-only review, push, and wait for the four workflows at the ending SHA.
6. Roll back a bad defect fix by revert or a corrective commit. Do not force-push `main` or delete historical evidence.

## Open Questions

None. Mode stays day unless the owner selects night. That selection does not change these decisions.
