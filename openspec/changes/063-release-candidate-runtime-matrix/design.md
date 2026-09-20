# Design — 063-release-candidate-runtime-matrix

## Artifact

`:app:assembleRelease` from the exact HEAD (no-daemon, versioned
outputs). Identity: `sha256sum` + bytes + `package/version` from
`app.json` + debug-signed local status + Metro independence (release
bundle packaged; launch with Metro stopped/killed to prove it).

## Runtime lane (dedicated AVD only, emulator-local input)

- Install: `adb install -r` (or clean `uninstall` first for the
  first-install sample); `scripts/android/` helpers for
  hierarchy/screenshot/logcat where they fit; `scripts/qa/ui-capture.mjs`
  for route-verified captures; `scripts/qa/a11y-audit.mjs` for the
  matrix audit.
- First-install sample: N clean installs (bounded, e.g. 3–5) + cold
  launches watching for ANR dialogs (`dumpsys` + pixels); one true
  emulator cold boot only if cheap.
- Relaunches: warm (`am start`), offline (airplane/emulator offline),
  force-stop + start.
- Routes via deep links (`braintraining://…`) + hierarchy verification;
  invalid/oversized/malformed variants per the route envelope.
- Provider: export → DocumentsUI open → cancel → back (no file
  selected, no import applied — retained-data boundary from 054).
- Background/foreground: Home → background 5s → foreground, state
  intact.
- Completion: one short real game (candidate: a 1–3 round quick game
  with simple taps) driven by hierarchy-guided taps to a result;
  verify XP/result render + `game_sessions` row via pulled DB;
  force-stop + relaunch retention.
- DB audit: pull SQLite file, `PRAGMA integrity_check`, FK check,
  `user_version`, duplicate session/ledger/rating-operation scans.
- Log review: `logcat -d` filtered for FATAL/ANR/React/SQLite/OOM/
  RedBox on the app PID across the matrix.

## Repair loop

Reproduced defect → minimal source fix → focused regression test →
rebuild → re-run affected matrix → record. No speculative work.

## Evidence layout

`docs/redesign/evidence/campaign063/` (committed, curated):
`ARTIFACT.md`, `STARTUP_MATRIX.md`, `ROUTE_MATRIX.md`,
`PROVIDER_LIFECYCLE.md`, `COMPLETION_PERSISTENCE.md`,
`SQLITE_AUDIT.md`, `LOG_REVIEW.md`, `CAMPAIGN063_CLOSURE.md`
(+ adversarial review). Raw captures/logs under `D:\Temp\campaign063-*`
(outside Git).
