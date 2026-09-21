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

## Native lanes — BLOCKED (environment, evidenced, not product)

Status: **NOT VALIDATED** — clean install/startup/lifecycle, routing/recovery,
deep-link exit proof, core journeys, weak/mid/strong results, four-game workout,
SQLite audit, log review, backup/import/export device paths, six-way pixel matrix
(66/66), device a11y audits, perf/resource device sanity.

Blocker (fatal, host-level, reproduced 5× across two AVDs):

- This Linux sandbox has no GPU (`/dev/dri` absent), no Android runtime of its own
  (SDK/emulator/AVD provisioned during this session), and its kernel KVM is
  broken: every guest start dies in `kernel BUG at arch/x86/kvm/x86.c:702
  (kvm_spurious_fault)` on vCPU creation (`dmesg`, 8 occurrences). The box user
  was granted `/dev/kvm` access and `emulator -accel-check` reports usable, but
  vCPU creation always faults — nested virtualization is not functional here.
- Attempts: pre-existing `braintraining-qa35` (3 boots: normal, adb-reset,
  `-no-snapshot` cold) + freshly created `braintraining-ui35` (pixel_7,
  google_apis x86_64, cold) on emulator 37.1.11 with KVM + `-gpu swiftshader`
  (modern software GL; the obsolete `swiftshader_indirect` value was NOT used).
  Every attempt stalls at 0.2–0.3% qemu CPU with the guest never registering on
  adb. `study-maker-api35` and any other runtime were never touched.
- Software-only fallback (`-accel off` TCG) was rejected: an API-35 boot would
  take the better part of an hour and the interactive 66-capture + workout
  matrix would be practically unusable and timing-invalid. Not attempted as
  certification evidence.

What this blocks: §§11–15 of the prompt on the final artifact. The prior
067-certified (`B7AA4102…`) and hardening (`146F63BF…`) device evidence stands for
its own historical scope; it is NOT re-issued onto `5FE03134…` here.

## Import/export hardening — repo lanes GREEN, device UI lanes BLOCKED

Exercised on the final tree without a device: export valid + round-trip through the
supported import path, malformed/oversized/deep-nesting/prototype-pollution/bounds
rejections, no-partial-apply, idempotent merge (adversarial + hardening + roundtrip
suites, all green); picker pre-read byte gate + paste `maxLength` + busy guards by
contract; the two-tap UI apply + system-provider open/cancel remain MANUAL/NOT
VALIDATED (unchanged from the 067 ledger).

## Boundaries (unchanged, explicit)

Human TalkBack/VoiceOver, iOS, physical/OEM, store signing/install, external
CI/account policy, human system-provider usability: MANUAL / EXTERNAL.
42-game six-way interaction expansion, crafted replace-import via UI, mid/strong
results, workout legs, soak, cold boot on the final artifact: NOT VALIDATED
(device-blocked; carried from the 067 ledger, not re-litigated).

## Next action

The program is safe to leave closed on the repository side: convergence is proven,
the final artifact is built and provenance-bound to the converged tree, and all
runnable gates are green. The single outstanding obligation is mechanical, not
investigative: **boot a working KVM/GPU Android runtime, install `5FE03134…`,
and re-issue the 067 matrix (native + workout + SQLite + logs + six-way
pixels/a11y + provider paths) on that exact artifact.** No source change is
needed first — but if any executable source changes, invalidate `5FE03134…`,
rebuild, and restart every artifact-dependent lane.
