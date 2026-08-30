# Campaign 016 — Terminal Validation Checkpoint

**Status:** VALIDATED — terminal repository state
**Campaign:** `016-release-certification-hardening`
**Date:** 2026-08-30
**Branch:** `main`
**Convergence start SHA:** `f0d301bc1b80ed657c75af81c476ee87dbeea540`
**Final certified source SHA:** `d987ab4dc058ee64b137490495b86b573f9764fa`
**Final certified terminal-source SHA:** `2663ec6d1f8052dde1364a8cdad35daea85b788f`
This is the pushed terminal source/checkpoint handoff whose exact-SHA Actions
wave is recorded below. Any later amendment to this file is documentation-only
and must receive its own exact-SHA CI wave before final handoff; the exact final
repository SHA is always verified with `git rev-parse HEAD` and
`HEAD == origin/main`.
**Origin parity:** required and verified at final handoff with `HEAD ==
origin/main`.
**Working tree:** required clean at final handoff; generated test/export
artifacts are not retained.

## Decision

Campaign 016 closes as:

> **LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING**

Repository-owned implementation, automated certification, native build-smoke,
and exact-source CI evidence are complete. The remaining Android runtime and
manual platform evidence is genuinely external/unavailable and remains
explicitly `BLOCKED`, `NOT VALIDATED`, or `DEFERRED`. No Campaign 017 was
created, and no game #43 or unrelated product scope was added.

## Repository identity and lifecycle

- Start: clean `main` at `f0d301bc1b80ed657c75af81c476ee87dbeea540`, with
  `origin/main` at the same SHA and no open pull requests.
- Convergence commit: `d987ab4dc058ee64b137490495b86b573f9764fa`, containing
  the terminal lifecycle reconciliation, validator terminal-state support,
  fresh evidence, and stale-branch decision.
- OpenSpec `change.json` is `VALIDATED`. `GOVERNANCE.activeCampaign` is
  explicitly `null`; `lastCampaign` is
  `016-release-certification-hardening`; `lastCampaignStatus` is `VALIDATED`.
- `STATE.md`, `CURRENT_CAMPAIGN.md`, `EXECUTION_PROMPT.md`, and
  `.agent/task-ownership.json` agree on the same terminal campaign. The
  terminal ownership record has no active coder packets; historical packet
  evidence remains in the task log and prior checkpoints.
- The older Android timeout is retained as historical evidence: run
  `33239131146` on `31a6143` stalled at `:app:compressReleaseAssets` and was
  cancelled at the 60-minute limit. It is not presented as the current result.

## Automated certification matrix

| Gate | Result and evidence |
| --- | --- |
| Repository state | PASS — `node scripts/validate-repo-state.mjs`; explicit terminal state reports no active campaign and 016 `VALIDATED` |
| OpenSpec | PASS — `npx --yes @fission-ai/openspec@1.6.0 validate --all`, 3/3 changes |
| Task ownership | PASS — `node scripts/validate-task-ownership.cjs`, terminal ownership with no active packets |
| Game registry | PASS — `node scripts/generate-game-registry.mjs --check` |
| Provenance | PASS — `node scripts/validate-provenance.mjs --check` |
| Offline boundary | PASS / CLEAN — 932 source files scanned |
| QA self-test | PASS — `node scripts/qa/autobot.mjs --self-test`, 49/49 |
| TypeScript | PASS — `npm run typecheck` |
| Lint | PASS — `npm run lint`, 0 errors / 0 warnings |
| Jest | PASS — 489 suites passed, 4 allowlisted skipped; 6,056 tests passed, 5 allowlisted skipped; 0 failures; 5 snapshots passed |
| Jest skip/warning signal | PASS — `validate-jest-signal.mjs` reports 0 unclassified, 0 ambiguous, and 0 unexpected warnings |
| Expo Doctor | PASS — 21/21 |
| Web export | PASS — 20 static routes |
| DB integrity/idempotency | PASS — current focused matrix and full Jest; duplicate delivery, constraints, rollback, lock, and degradation paths covered |
| Migrations | PASS — migration matrix, robustness, and v10 hardening suites |
| Backup/restore/rollback | PASS — 14 data-portability suites / 129 tests in the focused run, including adversarial and rollback cases; large-memory probe is the one allowlisted opt-in skip |
| Workout/persistence | PASS — focused DB/portability/workout run: 37 suites / 390 tests, one allowlisted opt-in skip |
| Production/security boundary | PASS — 6 suites / 28 focused tests; forbidden permission, QA-hook, storage-unavailable, and offline checks |
| Dependency audit | CLASSIFIED — full and `--omit=dev` each report 0 critical, 0 low, 12 moderate, 4 high, 16 total; all are classified build/dev-toolchain-only in `.agent/DEPENDENCY_AUDIT.md` |
| Secret scan | PASS — no tracked private keys, tokens, or secret-pattern hits |
| Performance probes | PASS — Node 22.23.2; `loadProgressSnapshot_20000=112.691259ms`, `exportLocalData_5000` with checksum `5155.865523ms`, second canonical serialization `936.613833ms`, `syncQuestProgress_20000=37.63658ms`, `syncAchievements_20000=98.749851ms` |

The ordinary local `npm ci` path was attempted but cannot compile
`better-sqlite3` on this host because `make` is unavailable. The documented
clean-run `npm ci --ignore-scripts` path passed under Node 22.23.2 and the
GitHub clean runners completed their normal install. This is not a product
failure or a reason to relabel the passing CI evidence.

## Native/platform matrix

| Platform gate | Result and evidence |
| --- | --- |
| Android clean native generation/build | PASS — Android Build Smoke `33293614561`, exact source SHA `f0d301bc1b80ed657c75af81c476ee87dbeea540`, job `Android clean native build`; clean generation, release APK compilation, release-boundary verification, and artifact upload |
| iOS simulator compile | PASS — iOS Build Smoke `33293614540`, same exact source SHA, job `iOS simulator compile smoke`; clean prebuild, CocoaPods, unsigned simulator compile |
| App CI | PASS — `33293614545`, same exact source SHA, job `Mobile app build/typecheck/tests` |
| Repository Integrity | PASS — `33293614543`, same exact source SHA, job `durable-state` |

These four runs are independently verified current-head evidence for the
source SHA. The final pushed terminal-source SHA
`2663ec6d1f8052dde1364a8cdad35daea85b788f` also received this exact-SHA wave:

| Final terminal-source workflow | Run | Result |
| --- | ---: | --- |
| App CI | `33312838064` | PASS |
| Repository Integrity | `33312838054` | PASS |
| Android Build Smoke | `33312838028` | PASS — clean generation, release APK, boundaries, artifact upload |
| iOS Build Smoke | `33312838019` | PASS — clean prebuild, CocoaPods, unsigned simulator compile |

iOS compile success is not manual iOS runtime UX success.

## Device and manual matrix

| Evidence | Classification | Reason |
| --- | --- | --- |
| Android dedicated install/start | BLOCKED / NOT VALIDATED | No designated `braintraining-qa36` AVD or physical ADB fallback is available; the only connected `study-maker-api35` emulator is foreign and was not used |
| Rule Grid / Transform Match / post-015 canaries | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Workout V3 daily/focus/relaunch | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Current-head 42/42 `autobot --mode certify` | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Android hierarchy | BLOCKED / NOT VALIDATED | Requires the unavailable designated project device |
| Emulator recovery | BLOCKED / NOT VALIDATED | Bounded 37.1.11/WHPX/qemu recovery reproduced the documented external failure; no blind retry or foreign-AVD substitution |
| TalkBack/manual accessibility | NOT VALIDATED | No manual accessibility session was performed |
| SAF/share/document-picker system sheets | NOT VALIDATED / DEFERRED | System consent UI is outside the emulator-local autobot policy |
| Physical-device behavior / refresh rate | NOT VALIDATED | No physical device is connected |
| iOS runtime UX | NOT VALIDATED / DEFERRED | No interactive macOS/iOS UX session was performed |
| Signing/store publication | DEFERRED | Constitution-deferred scope |

## Defect statement

- Unresolved Critical defects: **0**.
- Unresolved High defects: **0**.
- Material data-loss/corruption defects: **0**.
- Remaining Medium/Low items are external/manual platform limitations or
  accepted build-toolchain audit findings, not hidden product defects.

## Stale addon branch disposition

The remote branches `feat/repo-local-addons-2026-08-28` and
`plan/repo-local-addons-2026-08-28` were compared at content level before
deletion. No content was salvaged:

- The feature branch's root `.mcp.json` conflicts with the current onboarding
  policy, which deliberately commits no root MCP configuration and directs
  agents to the existing ADB/QA harness.
- Its handoff/master-plan text describes optional network-resolved Context7
  and Mobile MCP integrations that duplicate or sit outside the current
  repository-local agent structure.
- Its two validation scripts only probe that obsolete config and add no
  guarantee beyond the existing repository validators/QA harness.
- The plan branch contains only the same obsolete planning document.

Both remote branches were deleted explicitly after this comparison. No local
copies existed; final `git fetch --prune` must show only `origin/main`.

## Recovery rule

Do not reopen Campaign 016 or create Campaign 017 solely for the unavailable
device/manual evidence. If the owner later authorizes new scope, open a new
OpenSpec campaign deliberately and preserve this checkpoint as the terminal
016 record.
## Addendum — Post-validation Android device certification pass (2026-08-30)

**Session:** post-validation platform evidence/certification pass on dedicated Linux host (Debian 13 trixie, kernel 6.12.94+, 8 vCPU, 15 GiB RAM, 31 GiB disk free). `HEAD == origin/main == 0e5eb34` at session start; working tree clean; canonical branch `main`; `GOVERNANCE.activeCampaign == null`, Campaign 016 remains `VALIDATED` (no Campaign 017 created, per instruction).
**Host Android toolchain inventory (start):**
`- ANDROID_HOME=/home/box/Android/Sdk, ANDROID_SDK_ROOT=/home/box/Android/Sdk`
`- adb 37.0.1-15733141, emulator 37.1.11.0 (15917651), JDK Temurin 17.0.20.1, platforms android-35/36, build-tools 35.0.0/36.0.0, NDK 28.2.13676358`
`- Installed system-images at start: only `system-images;android-35;google_apis;x86_64` (9); `aosp_atd` not yet installed`
`- AVD inventory at start: only foreign `study-maker-api35` (google_apis API 35 pixel_2); designated `braintraining-qa36` absent; no physical ADB device (`adb devices -l` empty aside from foreign emulator when running)`
`- Hypervisor: KVM vendor present but `/dev/kvm` missing (`emulator -accel-check` reports accel=8, VT disabled / module not loaded; `modprobe` unavailable in container); host flags include `vmx` but no nested KVM; TCG/software emulation required (`-accel off`)`
`- Host memory at start: 7.9 Gi used / 7.8 Gi available / 7.2 Gi buff/cache, swap 3.6 Gi used`

**Dedicated AVD provisioning (this session):**
`- Created `braintraining-qa36` (pixel_7, `system-images;android-35;google_apis;x86_64`, `--force`) at 15:30 UTC; `emulator -list-avds` then showed `braintraining-qa36` + `study-maker-api35`; config `hw.ramSize=1536M` default, overridden at runtime via `-memory`.`
`- Initial launch used Linux TCG headless flags per project guidance (`-no-window -no-audio -no-boot-anim -no-skin -gpu off -accel off -cores 8 -memory 3072 -no-snapshot-load -no-snapshot-save -feature -Wifi`) — device registered as `emulator-5554 offline` within 5 s, then `device` after ~65 s, but never reached `sys.boot_completed=1` before qemu exit.`
`- After first attempt, `system-images;android-35;aosp_atd;x86_64` was found installed (installed during session via prior `avd.sh sdk-install-image` fallback path); `braintraining-qa36` config now points to `image.sysdir.1=system-images/android-35/aosp_atd/x86_64/` (lightweight ATD, preferred for headless).`
`- Created second dedicated AVD `braintraining-qa35` (`google_apis` x86_64) for bounded matrix comparison; final `emulator -list-avds` shows `braintraining-qa35`, `braintraining-qa36`, `study-maker-api35` — both `braintraining-*` are repository-dedicated and were never used as foreign certification targets.`
`- No foreign AVD was adopted, renamed, or mutated for certification; every boot targeted a `braintraining-*` AVD, verified via `BT_AVD_NAME` and `bt_our_serial` ownership checks.`

**Emulator stability — bounded matrix (4 attempts, hypothesis-driven, logs retained):**
`| # | AVD | Image | Flags | Result | Signature |`
`|---|-----|-------|-------|--------|-----------|`
`| 1 | braintraining-qa36 | aosp_atd x86_64 (auto-switched from google_apis) | `-gpu swiftshader_indirect -accel off -cores 6 -memory 3072 -no-snapshot-load -no-snapshot-save -feature -Wifi` (via `avd.sh` + `BT_EMULATOR_EXTRA_ARGS`) | `adb` saw `offline` → `device` after ~65 s, `init.svc.bootanim=stopped` but `sys.boot_completed` stayed empty, `pm` `Can't find service: package` for ~3 min, then `adb` flipped `device` → `offline`/`not found` and qemu exited at ~05:12 qemu time (15:38 UTC) | `tail` shows `Wait for emulator pid … 20 s to shutdown… Saving snapshot default_boot… stop: Not implemented… Netsim Wifi … gone due to CANCELLED` (graceful shutdown path after external kill/crash) + `WARNING: cannnot unmap ptr …` + `TCG doesn't support CPUID avx/f16c`; no kernel OOM for qemu in `dmesg` |`
`| 2 | braintraining-qa36 | aosp_atd | same image, `-cores 4 -memory 2048 -wipe-data` | `offline` persisted ~80 s then qemu exited while still `offline` (never reached `device`), same tail signature with `Netsim Wifi … gone due to CANCELLED` |`
`| 3 | braintraining-qa35 | google_apis x86_64 | `-gpu off -cores 6 -memory 3072` | `offline` ~50 s then qemu exited while `offline`, same tail | Docs predicted `google_apis` instability on 37.1.x — reproduced, as expected |`
`| 4 | braintraining-qa36 | aosp_atd | `-cores 2 -memory 1536 -gpu swiftshader_indirect` | `offline` → `device` after ~80 s, stayed `device` for ~5 min (`uptime` 2–4 min, `bootanim=stopped`, `sys.boot_completed` empty, `pm` still unavailable), then flipped `device` → `offline`/`not found` and qemu exited at ~05:12 qemu time (15:47 UTC) with same tail | Longest survival (device online ~5 min) but still before `sys.boot_completed`; validates that TCG cold boot (expected 8–20 min per docs) cannot complete before qemu instability |`
`All four launches used the repository-approved headless path (`emulator -avd … -no-window -no-audio -no-boot-anim -gpu … -no-metrics -feature -Wifi -accel off … -no-snapshot-load -no-snapshot-save`) and omitted host-mouse/keyboard; hierarchy/screenshot/input were not exercised because the device never completed `sys.boot_completed`.`
`Installed SDK at session end: `system-images;android-35;aosp_atd;x86_64` plus `google_apis;x86_64` now both present; platforms 35/36, build-tools 35/36, emulator 37.1.11 unchanged — no downgrade to older emulator was feasible via `sdkmanager --list` (only 37.1.11 offered; no pin to prior stable version without manual archive download). Therefore no stable configuration could be established with the current 37.1.11 TCG stack.`

**Physical ADB fallback:**
`- `adb devices -l` throughout session showed only `emulator-*` when an emulator was running, otherwise empty; no authorized physical device was connected (as expected on this Linux container host). This matches the instruction to not require physical evidence when emulator certification is attempted and to clearly distinguish emulator vs physical evidence.`

**Current-head runtime / build:**
`- Exact SHA at session start and end: `0e5eb34c13d87f2e4a8dfa40acb44e8d27e614a8` (`HEAD == origin/main`, clean tree before and after). No repository-owned code changes were required; no new product defects were discovered because the runtime harness never reached app install/launch.`
`- Automated gates re-validated on this SHA after the device matrix: `validate-repo-state` PASS (terminal 016 VALIDATED), `typecheck` PASS, `lint` PASS (0/0), `generate-game-registry --check` PASS, `validate-provenance --check` PASS, `validate-task-ownership` PASS, `validate-offline --check` PASS (932 files CLEAN), `full Jest` PASS (489 suites passed / 4 skipped allowlisted, 6056 tests passed / 5 skipped allowlisted, 0 failures), `expo-doctor` 21/21 PASS, `web export` 20 routes PASS. The Jest/doctor/export results reproduce the terminal checkpoint exactly.`
`- Native build smoke: not re-run locally this session (no code change); GitHub exact-SHA evidence remains `33293614561` (Android) and `33293614540` (iOS) on `f0d301bc1b80ed657c75af81c476ee87dbeea540` plus final terminal SHA `33312838028`/`33312838019` — documented as historical current-head remains. No new build artifact was produced because the device never reached `pm` readiness for install.`

**Device-test results on the dedicated AVD (all require `sys.boot_completed=1` and `pm`):**
`- Basic canaries (Home, navigation, game host, session persistence): NOT VALIDATED — device never completed boot, so no app install/launch was attempted.`
`- Rule Grid / Transform Match / post-015 canaries: NOT VALIDATED — same blocker.`
`- Workout V3 daily / focus / relaunch-process-death: NOT VALIDATED — same blocker.`
`- Full 42/42 `autobot --mode certify`: NOT VALIDATED — same blocker.`
`- Android hierarchy/accessibility dumps: NOT VALIDATED — `uiautomator dump` requires a booted `device` with `sys.boot_completed=1`; the device reached `device` state briefly after ~65–80 s but `sys.boot_completed` never became `1` and `pm`/`window` services never appeared, so hierarchy evidence could not be captured on a stable booted system.`
`- TalkBack manual UX: NOT VALIDATED (no manual session, as instructed not to fake hierarchy as TalkBack PASS).`
`- SAF/share/document-picker system sheets: NOT VALIDATED / MANUAL — outside autobot policy, unchanged.`

**Reassessment of the 8 previously open items (tasks.md §2.4, §3.3, §3.6, §3.7, §3.8, §3.9, §7.6, §8.7):**
`- 2.4 dedicated install/start: remains **BLOCKED/NOT VALIDATED** — dedicated AVD now exists (`braintraining-qa36` ATD + `braintraining-qa35` google_apis) but never reached stable `sys.boot_completed=1`/`pm` readiness, so `scripts/android/install.sh` was not executed on this SHA; prior `BUILD SUCCESSFUL` 80 M APK evidence at `f4aa44c` remains historical only.`
`- 3.3 known-stable emulator/toolchain candidate: remains **NOT VALIDATED** — bounded matrix of 4 hypothesis-driven configs on emulator 37.1.11 TCG (varying image `aosp_atd` vs `google_apis`, memory 3072→2048→1536, cores 6→4→2, gpu `swiftshader_indirect` vs `off`, wipe-data) all reproduced the same `Netsim Wifi gone due to CANCELLED` / graceful-shutdown exit before boot completion; no downgrade to older emulator is offered via `sdkmanager`; KVM (`/dev/kvm`) unavailable in this container (VT disabled / `modprobe` unavailable, `accel=8`), so no stable candidate exists on this machine. The documented 37.1.11 WHPX/qemu failure from 016 is now also reproduced on Linux TCG and remains the external blocker.`
`- 3.6 physical ADB fallback: **NOT AVAILABLE** — `adb devices -l` empty (no physical device), as documented; not required when emulator certification is attempted, per instruction.`
`- 3.7 Rule Grid/Transform Match/post-015 canaries: **NOT VALIDATED** — dedicated device never reached stable boot, so no canary was run.`
`- 3.8 Workout V3 daily/focus/relaunch: **NOT VALIDATED** — same blocker.`
`- 3.9 full 42/42 certify: **NOT VALIDATED** — same blocker.`
`- 7.6 Android hierarchy: **NOT VALIDATED** — no stable booted device to dump hierarchy; the transient `device` state before crash never yielded `sys.boot_completed=1`.`
`- 8.7 current-head Android journeys/certify: **NOT VALIDATED** — same blocker; the current-head SHA `0e5eb34` has no new Android runtime evidence beyond the bounded emulator matrix.`
`- Tasks 3.1, 3.2, 3.4, 3.5, 3.10 remain PASS with refreshed evidence (SDK inventory captured, failure reproduced once without blind retry, software-rendering/headless flags tested, dedicated AVD recreated from scriptable inputs, and BLOCKED honestly recorded).`

**Defects discovered in this pass:**
`- None — no repository-owned product or QA-harness defect was exposed because the harness never progressed to app install/launch/hierarchy. The only failures observed are the external emulator/qemu instability described above, which is not a product defect. Therefore 0 Critical, 0 High, 0 data-loss/corruption defects remain, unchanged from the terminal checkpoint.`

**Manual-only remainder (unchanged truthfully):**
`- TalkBack manual UX — NOT VALIDATED`
`- SAF/share/document-picker system sheets — NOT VALIDATED / MANUAL`
`- Physical-device-only behavior / refresh rate — NOT VALIDATED`
`- iOS interactive UX — NOT VALIDATED`
`- Signing / store publication — DEFERRED`

**Git at addendum close:**
`- Start SHA: `0e5eb34c13d87f2e4a8dfa40acb44e8d27e614a8``
`- Final SHA after documentation-only amendment: (to be recorded at push; `HEAD == origin/main` required, `git status` clean, only `origin/main` remote branch, no active campaign, Campaign 016 remains VALIDATED, no Campaign 017).`
`- This addendum is documentation-only; it does not reopen Campaign 016 to ACTIVE and does not create Campaign 017. The classification remains **LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING** on this machine until a stable device (different host, KVM-enabled Linux, or physical device) completes the Android runtime matrix.`

