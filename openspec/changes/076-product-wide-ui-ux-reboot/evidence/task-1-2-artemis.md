# Task 1.2 — Dedicated AVD + ARTEMIS verification (2026-10-04)

## Result: READY (device lane available)

| Check | Result | Evidence |
| --- | --- | --- |
| Dedicated AVD running | `emulator-5554` = `braintraining-ui35`, Android 15 (API 35), `sdk_gphone64_x86_64`, 1080×2400 @ 420dpi | `adb devices`, `wm size`, `getprop` captured 2026-10-04 |
| Old baseline app installed | `com.braintraining.app` versionName 0.1.0, `lastUpdateTime=2026-10-04 08:22`, install = release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` (matches `evidence/before/index.json` `apkSha256`; local `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` hashes identically) | `dumpsys package` + local `sha256sum` |
| App launches to foreground | `am start -W` → `mCurrentFocus=...com.braintraining.app/.MainActivity`; real composited 1080×2400 frame captured (nonblank) | `scripts/android/launch.sh` (BT_AVD_NAME=braintraining-ui35) + probe PNG |
| ARTEMIS checkout | `D:\Tools\artemis` (external, not vendored); venv `.venv` | directory present |
| ARTEMIS `doctor` | **Status: Ready — all system checks passed**: Python 3.12.11 venv OK; system config loaded (Planner gemini-3.8-flash); MCP/IDE integration host OK (daemon auto-starts on first task); Gemini multimodal API key active; device/emulator connected (1080×2400); FFmpeg + scrcpy available; Showcase UI compiled; Accessibility Helper ready. Raw output: `task-1-2-artemis-doctor.raw.txt` | `python -m artemis doctor` (2026-10-04) |
| Supported MCP server | `python -m artemis mcp` is the supported Codex MCP integration (mobile_run_task / mobile_manage_task / mobile_inspect_trace). It is **not registered in this agent session's MCP config**; ARTEMIS is therefore driven through its supported CLI (`python -m artemis run/batch/trace`), which is the same runtime/daemon and writes the same traces. No broad `mcp --install all` bootstrap was run in this repository. | `python -m artemis --help` |
| Provider credentials | Configured only in the external ARTEMIS environment (`D:\Tools\artemis\config\artemis.jsonc` + env); never printed, committed, or logged here. | doctor output shows masked key only |

## Journey policy for this change

- **Flash** (`--profile flash`): short smoke coverage (route arrival, single-surface checks).
- **Pro** (`--profile pro`): stateful journeys — first-run, daily workout, resume, game result, workout completion, diagnostic and error-recovery (task 14.4), plus stubborn per-game stateful play during baseline capture when scripted emulator-local taps cannot reach a state.
- Screenshots/hierarchy for the evidence matrices come from the deterministic ADB lane (`scripts/qa/ui-capture.mjs`, `scripts/android/*`, `qa-artifacts/076-ui-reboot/` drivers) — emulator-local input only.
- **No host-input automation**: no host mouse/keyboard injection, no focus stealing, no absolute desktop coordinates. All input is `adb shell input` on the emulator or ARTEMIS's on-device accessibility lane.
- Historical note preserved: earlier campaigns recorded ARTEMIS Flash `MissingSessionID` BLOCKED conditions on the MCP path; if that reproduces here it will be recorded per-journey with the CLI fallback used instead (per design.md decision 4).

## BLOCKED conditions (none currently)

None. If the ARTEMIS daemon or LLM credential fails mid-campaign, the affected
journey is recorded BLOCKED with the exact error and the deterministic ADB
lane continues capture work; no journey is silently replaced by host-input
automation.
