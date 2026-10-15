# Native08 and current-source certification

Status at this checkpoint: **BUILD/STAGING PASS; INSTALLATION AND DEVICE ACCEPTANCE OPEN**.
ARTEMIS Data07 exclusively owns emulator-5570 while this record is written.
No native08 screenshot, installation or runtime acceptance is inferred from native07.

Later Data07 independently qualifies the actual restore journey, while exposing
a confirmation-label reflow defect. [RUNTIME_DATA07.md](RUNTIME_DATA07.md) records
the actual native failure and source followup. Native08 remains staged and never
installed; native09 will supersede it with that additional layout correction.

## Exact source and APK

Source `6c0829c8a7dd430773685739cdb842842672ca32` adds the Home read-availability
repair documented in [HOME_READ_AVAILABILITY.md](HOME_READ_AVAILABILITY.md).
The committed snapshot was completely prepared before Gradle started.

- Build: 532 tasks, 24 executed/508 up to date, 5m54s; terminal exit0.
- APK SHA-256: `cbb5aeb26083f38e1e84bbde08cb985f0b065a94fab2613e7d5cc0268d9a4f2f`.
- APK: 52,310,051 bytes, `com.braintraining.app` 0.1.0/1000, x86_64,
  target SDK36, debug-signed release. Eight permissions match the existing allowlist.
- Exact committed inventory: 1,107 files; SHA-256
  `64d3cf27031f58ef14aab8cd387a30ce5a909319b4c7476cf96a7855fc7ebd73`.
- Source map: all941 mapped own-source files match committed bytes; the single
  changed production file is present and exact. Virtual router context is
  classified separately; no production file is excluded.
- Packaged Hermes bundle equals the generated bundle, SHA-256
  `d7ba5eb47b4592514bdecf5c354a73fba7a27a3a4a24bd154548c4dff17c6c2d`.
- All9 illustrations are packaged pixel-identically and all3 Manrope fonts are
  byte-identical. The9MiB decoded RGBA asset total is a static footprint, not
  measured process memory or proof that all images are simultaneously resident.

Local evidence: `qa-artifacts/campaign077/native-preview08/` source/build identity,
bundle-source proof, permission check, APK and packaged-asset proof;
`preview08-build.log`. These binaries/generated artifacts remain outside Git.

## Actual fresh-checkout composite

The first attempt to reuse `D:/bt077-cert-d62bbfc7` after fast-forward correctly
failed fresh-checkout preflight because it retained dependencies/.expo. Its
`clean-checkout-6c0829c8.log` remains a failed diagnostic, not certification.
The preflight was not weakened and dependencies were not relabeled fresh.

A separate fresh independent clone `D:/bt077-cert-6c0829c8`, with recorded clean
identity/no inherited dependency or generated-native directories, ran the full
unflagged `node scripts/certification/certify-clean-checkout.mjs` on6c0829c8.
It finished with **certify-clean-checkout: PASS** and
`tracked_mutation_after_clean_run=PASS`. Independent post-run Git status is empty.

All declared composite gates pass, including fresh npmci, strict OpenSpec62,
registry/provenance/ownership/repository state, offline/secrets/runtime-QA,
workflow/map/Expo alignment, dependency audit, types/full lint, web22,
full Jest and signal classification. The exact aggregate is:

- 703 passed suites, four skipped suites; no failed suite.
- 7,921 passed tests, five explicitly classified opt-in skips; no failed test.
- Five matched snapshots; zero updated/unmatched/unchecked snapshots.
- Jest reports436.351s; JSON start-to-last-suite interval436.359s.
- Summary SHA-256 `1080cd2b4f22df7a36259a2504e38c5fe1d80edf804d50e7fbd9ff35297a3d3a`.
- Full log SHA-256 `f9fd260081f11b659a686e50a1f464fd58f2ba3a969d307e4983aad5b269c329`.

Local `clean-checkout-6c0829c8-fresh02-{identity,result}.json`,
`clean-checkout-6c0829c8-fresh02-jest-summary.json` and `.log` preserve the run.
No Jest worker forced-exit warning appears in this log. Expo's web-export
housekeeping forced-exit message, font/CSS warnings and Node DEP0190 remain
recorded; they are not silently erased or represented as clean process teardown.
The production audit retains the ten existing accepted advisories, with no new
unallowlisted moderate-or-higher finding. Earlier d62's five stale canary failures
remain historical failures; this actual full run qualifies their correction.

## Four workflows at this source

All are completed SUCCESS at the full6c0829c8 SHA, independently queried via `gh`:

| Workflow | Run |
|---|---|
| App CI | [38714343817](https://github.com/quantdale/brain-training/actions/runs/38714343817) |
| Repository Integrity | [38714344003](https://github.com/quantdale/brain-training/actions/runs/38714344003) |
| Android Build Smoke | [38714343901](https://github.com/quantdale/brain-training/actions/runs/38714343901) |
| iOS Build Smoke | [38714343701](https://github.com/quantdale/brain-training/actions/runs/38714343701) |

These qualify6c0829c8, not a future ending SHA. iOS compilation does not establish
iOS runtime evidence.

## Still required

Data07 terminal report/actual Replace outcome and independent SQLite verification;
native08 exact-data-preserving installation/device hash and observed Home;
full corrected-build profiles/gallery/actual critique; selected compact/2x
tutorial risks; current-day four-game workout/offline/pause/restart; bounded
quiet rendering/startup/memory/logcat; final source reconciliation/ending-SHA CI,
clean pushed main and visible Home handoff. Native07's performance observations
remain unresolved until actual controls, not presumed fixed by a Home copy guard.

`PHYSICAL_ANDROID = NOT VALIDATED`; `IOS_RUNTIME = NOT VALIDATED`; ARM64 unproven;
store signing NOT READY. Owner review remains required. Full077 stays ACTIVE.
