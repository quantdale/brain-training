# QA Artifacts Layout

Structured, reproducible evidence for autonomous QA runs and failure diagnosis.
Consumed by the Android harness (task packet 001-d, `scripts/android/**`),
orchestrators, and any fresh agent that must diagnose a failure from artifacts
alone.

## Location and lifecycle

- Root directory: `qa-artifacts/` (gitignored — never commit artifacts).
- One directory per QA run: `qa-artifacts/<run-id>/`.
- Runs are disposable evidence: clean up old runs (e.g. keep the last N) as
  needed; nothing outside the run directory is required for diagnosis.

## Run ID

`<UTC timestamp YYYYMMDD-HHMMSS>-<purpose>` — e.g.
`20260816-160042-memory-game-smoke`. Append tags when useful
(`-night`, `-retry-2`). Timestamps are UTC to keep concurrent agents
unambiguous.

## Layout

```text
qa-artifacts/<run-id>/
├── run.json                 # machine-readable manifest (write last, atomic)
├── exit-codes.txt           # one "<command> -> <exit code>" line per command
├── screenshots/             # PNGs, named <step>-<seq>.png (e.g. home-01.png)
├── logcat/                  # logcat.txt (full) + logcat-filtered.txt (W/E)
├── hierarchy/               # uiautomator XML dumps, <step>-hierarchy.xml
├── video/                   # optional screen recordings, <step>.mp4
└── app/                     # optional app-side diagnostics (structured logs,
                             # crash reports, diagnostic dumps)
```

## `run.json` schema

```json
{
  "runId": "20260816-160042-memory-game-smoke",
  "purpose": "memory game smoke",
  "startedAt": "2026-08-16T16:00:42Z",
  "endedAt": "2026-08-16T16:04:11Z",
  "appVersion": "0.1.0",
  "commit": "cc40262",
  "emulator": "braintraining35",
  "exitCode": 0,
  "steps": [
    {
      "name": "install",
      "status": "PASS",
      "exitCode": 0,
      "artifacts": ["exit-codes.txt"]
    }
  ]
}
```

`steps[].artifacts` holds paths relative to the run directory. Write `run.json`
last (temp file + rename) so a crashed run is visible as a missing/incomplete
manifest rather than a false success.

## Capture commands (Android, emulator-local — no host input)

- Screenshot: `adb exec-out screencap -p > screenshots/<step>-01.png`
- Logcat: `adb logcat -d > logcat/logcat.txt` (retain the raw dump; filtered
  W/E variant optional but recommended)
- Hierarchy: `adb shell uiautomator dump /sdcard/<step>-hierarchy.xml && adb pull /sdcard/<step>-hierarchy.xml hierarchy/`
- Exit codes: append `echo "<command> -> $?"` for every harness command to
  `exit-codes.txt`; also record step status/exit code in `run.json`
- Video (optional): `adb shell screenrecord`

## Consumption rules

- Read `run.json` and `exit-codes.txt` first: they tell which steps ran, which
  failed, and with what exit code.
- On failure, inspect `screenshots/` and `hierarchy/` from the failing step,
  then `logcat/logcat-filtered.txt` for the error.
- Failure reports (`.agent/KNOWN_ISSUES.md` entries, bug reports) must cite the
  run directory and failing step so the failure is reproducible.
- A run without a `run.json` is by definition incomplete; do not treat it as
  PASS.

## Exit-code conventions

- `0` — step passed
- `1` — step failed
- `2` — step blocked / unusable environment (record reason in `run.json`)
- `124`+ — timeout (harness-defined), recorded with the deadline used
