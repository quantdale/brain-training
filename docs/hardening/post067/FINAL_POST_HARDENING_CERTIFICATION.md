# Post-067 terminal re-certification — final certification record

**Prompt:** `.agent/POST067_TERMINAL_RECERTIFICATION_CONVERGENCE_PROMPT.md`
**Starting SHA:** `e444ec3` (synced remote `main`; docs-only prompt commit)
**Final executable checkpoint:** uncommitted working tree at close (10 source/test/config
fixes + `logic-order-path` generatorVersion `1.0.1` + regenerated registry; commit SHA
recorded at push — no executable change after the artifact build)
**Terminal verdict:** `POST_067_TERMINAL_RECERTIFICATION_PARTIAL`
(Overall `PROGRAM_056_067_AND_POST_HARDENING_TERMINAL_COMPLETE` is NOT claimed:
artifact-dependent device lanes are environment-blocked, see §Native.)

## Final artifact (built from the exact converged tree)

```
APK:   apps/mobile/android/app/build/outputs/apk/release/app-release.apk
SHA256: 5FE03134BB3C54123329E373F1A2121FD36C7E2C92C3CD161AEB89BD05FF3DDA
bytes:  109,604,449
package: com.braintraining.app  versionCode=1000  versionName=0.1.0
targetSdk=36  compileSdk=36  label='Brain Training'
signing: local debug-signed release (Android Debug cert) — NOT a store artifact
build: :app:assembleRelease --no-daemon → exit 0 (this host, SDK 35.0.0, JDK 21)
```

Embedded release bundle (proves the post-fix source):

```
assets/index.android.bundle
SHA256: 423A87185B48CC5A42F4F93FACC0A5D2C59B3385B4F60231A1411478C4174023
bytes:  4,886,112
```

Bundle-freshness markers 10/10 present (`PRAGMA foreign_keys = ON`,
`canonicalSeedToNumber`, `canonicalClamp01`, `progressionSeedVersion`,
`workout-reroll:`, `deleteEmptyWorkoutInstances`, `useSafeBack`, `MAX_QUEUED_TOASTS`,
`stabilizeDiscoverySnapshot`, `launchAnimation`) **plus** 4 new-tree markers proving
this APK came from the converged tree: `echoId`, `intro-back`, `Back to games`,
`validateBackupName`.

Permissions: `aapt2 dump permissions` vs `scripts/android/expected-apk-permissions.txt` →
**PERMISSION_SET_MATCH (8 permissions)**. Note: both storage permissions now carry
`maxSdkVersion='32'` (Expo-scoped), which partially mitigates R3-F8 in practice.

Metro independence: bundle embedded; device launch without Metro is part of the
blocked native lane below (not claimed).

## Repository matrix (final tree) — GREEN

Full gated Jest 598 suites (594 passed + 4 skipped) / 6,939 passed + 5 skips /
5 snapshots / 0 unexpected console output; signal PASS; allowlist OK;
typecheck/lint exit 0; Expo Doctor 21/21; OpenSpec `--all --strict` 51/51;
repo-state + task-ownership PASS; affected-map sync OK (21 areas) + self-test 16/16;
registry `--check` PASS; provenance no-drift + freshness OK; offline/secrets/workflows/
dependency-audit/runtime-QA PASS; probes 5/5; web export PASS; release + debug builds
exit 0. Full table in `TERMINAL_RECERT_CONVERGENCE.md`.

## Residual convergence — GREEN

R1/R2/R3 whole-repo passes + R4 post-fix pass: 0 open repository-owned
Critical/High/Medium defects. 10 bounded Low fixes landed with regression tests;
remaining items are accepted Lows / time-bounded debt / disclosed product decisions
(`TERMINAL_RECERT_CONVERGENCE.md`, `.agent/BACKLOG.md`).

## Native lanes — PARTIAL (device evidence collected under TCG; hard limits remain)

Environment path actually executed: host-kernel KVM is broken (`kvm_spurious_fault`
BUG on every vCPU creation, 8× in `dmesg`; no GPU; no nested virt), so after 5
failed KVM boots across `braintraining-qa35` and fresh `braintraining-ui35`
(emulator 37.1.11), the session fell back to software emulation (`-accel off`
TCG) on `braintraining-ui35` (pixel_7, google_apis x86_64, `-gpu swiftshader`
modern software GL — the obsolete `swiftshader_indirect` value was NOT used).
First TCG boot ~17 min; later reboots ~5 min. `study-maker-api35` and any other
runtime were never touched. All automation emulator-local (adb only).

### Validated on the exact final artifact `5FE03134…`

- Clean install (hash-verified `5FE03134…`, `Success`) + cold first launch to
  foregrounded MainActivity with no Metro anywhere (port 8081 empty).
- Warm launch `Status: ok`; force-stop → relaunch resumes MainActivity;
  Home re-verified with `0/4` retention across reboot AND force-stop.
- Route-verified Home ×3 (`BRAIN TRAINING`, `Today's Workout`, `0/4`);
  Games library (`TRAIN YOUR BRAIN`, 150 nodes); Memory + Tap Rush Game Detail;
  Data Management (honest copy, `Ready`, counts).
- **Post-hardening deep-link exit fix proven twice:** warm deep link → game →
  pause overlay (`Paused`/`Resume`/`Quit`) → Quit lands safely on Home; cold
  deep link (empty stack) → intro `Back to games` lands on **Games**. No
  dead-end, no strand. The shared intro exit (R3-F4 fix) is live on device.
- Live gameplay observed (`Round 1/5`, `Score 0`, `Now repeat it`); pause
  overlay correct.
- **Export proven:** `Export to JSON` → `Full backup is 14043 characters` →
  `brain-training-backup_2026-09-21_20-45-33.json` written AND listed with
  Load/Share/Delete (write/list symmetry live).
- Frames: real composited 1080×2400 throughout (1–4k unique colors; PIL-gated).
- Logs: 60,521-line terminal pull — 4 FATALs, all `DeadSystemException` in
  system processes (reboot fallout); 0 OOM/SIGSEGV/force-finish; 0 RedBox/JS/
  SQLite-fatal markers. One observed `ANR in com.braintraining.app` during a
  TCG cold start (app recovered and continued to full function; TCG-throughput
  artifact, not a product defect — disclosed, not hidden).
- Raw device evidence (16 dumps/captures, gitignored):
  `qa-artifacts/terminal-recert/device-lanes/`.

### Still NOT VALIDATED (honest remainder)

Weak/mid/strong completion, four-game workout, SQLite row-level audit
(release is not debuggable; export-content audit needs a completed session),
import preview-apply confirmation, provider open/cancel, offline launch,
malformed/oversized route probes, six-way pixel matrix, device a11y audits.

Why: under TCG the system emits recurring systemui/launcher/process-system ANR
dialogs (throughput artifacts) that invalidate the prompt's dialog-free-capture
and 0-ANR requirements, and uiautomator/dumpsys wedge repeatedly (including
`UiAutomation` connect-timeout FATALS in shell instrumentation, attributed,
not the app). Sustained interaction (completion ≈ 1 h, workout ≈ 3–6 h,
66-matrix ≈ 6+ h) is not certification-viable at ~5–8 min/surface with
~20–30 min stability windows. These lanes stay NOT VALIDATED, never green.

The prior 067-certified (`B7AA4102…`) and hardening (`146F63BF…`) device evidence
stands for its own historical scope; completion/workout/pixel/a11y lanes are
NOT re-issued onto `5FE03134…` here.

## Import/export hardening — repo lanes GREEN, device lanes PARTIAL

Exercised on the final tree without a device: export valid + round-trip through the
supported import path, malformed/oversized/deep-nesting/prototype-pollution/bounds
rejections, no-partial-apply, idempotent merge (adversarial + hardening + roundtrip
suites, all green); picker pre-read byte gate + paste `maxLength` + busy guards by
contract. **On device: export + listing proven** (14,043-char backup written and
listed with Load/Share/Delete); import preview-apply confirmation + two-tap UI
apply + system-provider open/cancel remain MANUAL/NOT VALIDATED (unchanged from
the 067 ledger).

## Boundaries (unchanged, explicit)

Human TalkBack/VoiceOver, iOS, physical/OEM, store signing/install, external
CI/account policy, human system-provider usability: MANUAL / EXTERNAL.
42-game six-way interaction expansion, crafted replace-import via UI, mid/strong
results, workout legs, soak, cold boot on the final artifact: NOT VALIDATED
(device-blocked; carried from the 067 ledger, not re-litigated).

## Next action

The program is safe to leave closed on the repository side: convergence is proven,
the final artifact is built and provenance-bound to the converged tree, all
runnable gates are green, and substantial device evidence now exists on the exact
artifact (launches, routes, exit fix ×2, live gameplay, pause/quit, export +
listing, retention, log review). The outstanding obligation is mechanical, not
investigative: **on a working KVM/GPU Android runtime, install `5FE03134…` and
re-issue the remainder (weak/mid/strong completion, four-game workout, SQLite
row audit, import preview-apply, provider paths, offline/malformed probes,
six-way pixels/a11y) on that exact artifact.** No source change is needed
first — but if any executable source changes, invalidate `5FE03134…`, rebuild,
and restart every artifact-dependent lane.
