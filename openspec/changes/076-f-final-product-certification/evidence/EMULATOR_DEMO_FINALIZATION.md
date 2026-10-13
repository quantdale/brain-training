# Emulator Finalization & Live Demo — 2026-10-13 (current)

Final stabilization pass under the owner's live-demo directive. **No application
source changed, so the terminal APK was NOT rebuilt** and every historical
certification identity is preserved unchanged.

## Identity (unchanged, re-verified this pass)

| Item | Value |
| --- | --- |
| Starting / ending SHA | `3f5a8ec2` (`main` == `origin/main`, clean, single worktree) |
| Application source | `d5787ec` (last app-source commit; later commits are evidence/test-only) |
| Release APK | `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` |
| APK size | 48,888,528 B |
| Package / version | `com.braintraining.app` versionName `0.1.0`, versionCode `1000` |
| ABI | `x86_64` (emulator only; **not** physical ARM64) |
| Signing | Expo **debug** keystore (`CN=Android Debug`, SHA-1 `5e8f16062ea3cd2c4a0d547876baa6f38cabf625`), APK Signature Scheme **v2** |
| Installed-device base.apk SHA-256 | byte-identical to the host artifact |

The on-disk APK hashes to `c8c3d46c…`; the only post-`d5787ec` change under
`apps/mobile` is `button-disabled-state.test.tsx` (a test file), which does not
affect the artifact — no rebuild was justified or performed.

## Live emulator (GUI, owner-visible)

| Check | Result |
| --- | --- |
| AVD | `braintraining-ui35` (Android 15 / API 35, google_apis, x86_64, 1080×2400 @ 420) |
| Device serial / port | `emulator-5570` |
| GUI visible | **YES** — `qemu-system-x86_64` window titled `Android Emulator - braintraining-ui35:5570`, not minimized (`IsIconic=False`) |
| Boot | `sys.boot_completed=1`, `init.svc.bootanim=stopped` |
| ADB | device online; screencap + uiautomator hierarchy both work |
| GPU | `-gpu host` (the historically validated mode) |
| Launcher | stock Nexus Launcher renders correctly |

Stale AVD lock (`hardware-qemu.ini.lock/pid=100232`, process confirmed not
running) was cleared before launch. Port 5570 was free; ports 5554/5555 remain
held by the known-unreapable historical process and were not touched.

## Runtime checks measured this pass

- **Cold startup:** 2240 ms (first), then 3361/2072/1420 ms across the session
  (the 3361 ms sample followed a live theme switch). No blank frames.
- **Home / Games / Progress / Rewards / Profile / Data Management:** all render.
  Games shows **"Showing 42 of 42 games"** with domain filters.
- **Representative gameplay (4 domains, no ARTEMIS):** Target Count (Attention),
  Card Sort (Flexibility), Number Line (Math), Word Scramble (Language) — round
  start, timed response, ✓/✖ feedback, score (176 → 932), pause/resume, and a
  completed standalone session (score 333, +18 XP / +3 coins, "Progress saved").
- **Workout:** Start → 4 legs → **"Workout complete — 4/4 games complete"** on the
  same session, ending Home at **"4/4 games saved"**.
- **Persistence across force-stop (cold relaunch):** mid-workout kill retained
  **1/4 complete / "Next: Target Count" / "Continue workout"**; Progress then read
  **2 sessions**, Profile reached **Level 2** — SQLite durability confirmed.
- **Offline:** Wi-Fi/data off + airplane mode (Active default network: none) —
  cold launch succeeded and the full app remained usable.
- **Invalid route:** `braintraining:///game/does-not-exist` → **"Game not found"**
  → **"Back to library"**.
- **Theme transition:** OS dark mode produced a correct dark render with adapted
  tokens; restored to light afterwards.
- **Enlarged text (font_scale 2.0):** content reflows; the Home CTA stays
  reachable by scrolling inside a verified scrollable container — the
  historically accepted LOW debt, no new defect.
- **Reduced motion:** animator/transition/window scales set to 0; navigation and
  round transitions remained functional.
- **Background/foreground:** HOME then relaunch resumed cleanly.
- **Logcat:** **0** FATAL / app-ANR / SQLiteException / RedBox / unhandled-error
  lines across **82,971** log lines (the only `AndroidRuntime` lines are the
  `uiautomator` helper process).
- **Memory:** ~180 MB PSS after heavy use.

## Repository / engineering validation measured this pass

All run in the interactive tree unless noted:

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | PASS (exit 0) |
| `expo lint --max-warnings=0` | PASS |
| Full Jest | **623 passed / 4 skipped suites, 7,248 passed / 5 skipped tests, 5 snapshots**, exit 0 |
| Strict OpenSpec `@1.9.0 validate --all --strict` | **61/61** |
| Clean-checkout composite (disposable `D:/bt-clean-cert` worktree, **no** skip flags) | **PASS — 20/20**, worktree removed after |
| Dependency audit | PASS — 10 accepted advisories, 0 unallowlisted moderate+ production findings |
| `validate-repo-state` / task-ownership / registry / provenance / offline / secrets / workflows / affected-sync / runtime-QA contract / Expo-alignment | all PASS |
| APK permission set | **8/8 exact match** to `scripts/android/expected-apk-permissions.txt` |

The composite ran npm ci, repository state, task ownership, OpenSpec, registry,
provenance (+self-test), jest-signal (+self-test), offline boundary, secret
boundary, workflow hygiene, dependency audit, affected-map sync, runtime-QA
contract, typecheck, lint, web export, Expo alignment, full Jest (623/7,248/5),
jest signal, and tracked-mutation-after-run — every step PASS.

## Boundaries (unchanged, not waived)

- `PHYSICAL_ANDROID: NOT VALIDATED` — no physical device attached; the x86_64
  APK is an emulator artifact and is **not** evidence of ARM64 physical readiness.
- `IOS_RUNTIME: NOT VALIDATED` — no macOS host.
- `PLAY_STORE_SIGNING: NOT READY` — debug-signed; an upload keystore + Play App
  Signing is required before any store publication.
- Formal release acceptance stays `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` on
  parent **14.3** (still OPEN); the owner-approved limited-private-beta exception
  is a beta-scoped acceptance of that evidence debt, not proof the evidence exists.

## Signing / release-engineering notes (Phase 5)

- **Why debug signing is valid now:** the keystore is the committed Expo debug
  keystore, so the artifact is reproducible and sideloadable for controlled
  local/emulator testing; APK v2 signature verifies.
- **Why it is unsuitable for store release:** a debug key is publicly known, has
  no upload-key separation, and cannot support Play App Signing or key rotation.
- **How production signing should be configured:** generate an upload keystore
  outside the repo, keep it in CI secrets (never committed), and let Play App
  Signing hold the app-signing key; set `android.keystore`/`credentials` via a
  local `credentials.json` (gitignored) or EAS credentials.
- **Update-compatibility implication:** changing the signing certificate breaks
  in-place upgrade for any already-installed debug-signed build — a
  production-signed build must be a **fresh install** for existing sideloaded
  users.
- **Upgrade testing:** a genuine upgrade test needs a **higher** `versionCode`
  (currently `1000`); same-versionCode reinstalls were validated but do not
  exercise the Android upgrade path.
- **ARM64 readiness:** the catalog and config are ABI-agnostic; a physical build
  requires adding `arm64-v8a` (and/or a universal APK/AAB) to `abiFilters` and
  re-running the device-persistence checks on real hardware.
