# Tasks — 063-release-candidate-runtime-matrix

- [x] 1. Release build from exact HEAD + artifact identity (bundle-marker proven, machine evidence committed).
- [x] 2. Startup matrix (3 clean installs + warm/offline/force-stop, 0 ANR; first-install ANR a bounded smoke).
- [x] 3. Route + recovery (unknown/oversized/malformed/detail) + share/picker open-cancel + lifecycle matrix; a11y JSON committed.
- [x] 4. Weak-path real completion + relaunch retention + SQLite audit (ok/v12/0-dup/0-FK) + 24,792-line log review (0 fatal).
- [x] 5. No defects reproduced (no repair loop); adversarial NOT_READY fully closed with evidence/narrowing; durable state; commit; push.
