# Campaign 046 Runtime Notes

## Runtime boundary

All gameplay and persistence observations used the dedicated
`braintraining-ui35` / `emulator-5554` device. The Study Maker
`emulator-5556` was not touched. Raw screenshots, UI dumps, and pulled SQLite
artifacts remain outside Git under `D:\Temp\campaign046-runtime`.

The debug Metro run emitted successful `game-session-start`,
`game-first-interaction-latency`, and `session-persist-duration` markers for
the final canary games. The final release-package app-only logcat review found
no fatal exception, ANR, React Native error, script-load failure, SQLite error,
database-lock signal, or OOM marker; `MainActivity` remained resumed.

## Tooling observations

Two environment behaviors were recorded without converting them into product
defects:

1. Concurrent UIAutomator/ADB activity can make a dump or shell command stall
   or emit a shell-side connection failure. Re-running the check after the
   contention cleared produced the expected hierarchy and app-only logcat was
   clean.
2. A debug/dev-client cold launch can show the Expo splash or a black frame
   while the split JS bundle and bootstrap work complete. This is a debug
   tooling boundary; the Metro-independent release APK continued to launch and
   render Home in the Campaign 048 cold-start sample.

The transient early screenshots that appeared to show XP 0 were captured
before the result animation settled. After the result settled, the UI and the
database both showed XP 50 and the corresponding reward ledger entry for the
affected canaries. No scoring or persistence defect was reproduced.

## Source-change boundary

No game, SDK, persistence, migration, navigation, or scoring source was
changed for Campaign 046. Evidence and durable-state updates are the only
repository changes in this checkpoint.
