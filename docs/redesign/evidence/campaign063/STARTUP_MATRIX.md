# Campaign 063 — Startup Matrix (exact artifact `20e28c64`)

| # | Launch | Result |
|---|--------|--------|
| 1 | Clean install + cold first launch | `COLD`, `TotalTime: 2121`, Home 109 nodes, no ANR |
| 2 | Warm relaunch (`am start`) | `TotalTime: 0` (resumed), Home intact |
| 3 | Offline + force-stop relaunch | `TotalTime: 2568`, Home 109 nodes |
| 4 | Post-completion force-stop relaunch | `TotalTime: 1552`, Home intact |
| 5 | Clean install #2 + cold launch | `TotalTime: 2518`, Home 109 nodes, no ANR |
| 6 | Clean install #3 + cold launch | `TotalTime: 2646`, Home 109 nodes, no ANR |

- ANR dialogs across all launches: **0** (`dumpsys` + pixels).
- First-install ANR (historical `050` single observation): **NOT
  REPRODUCED** in this 3-install bounded sample (consistent with 054's
  30-launch bounded result; still not a clean-launch global claim).
- First-launch content: real Today's Workout (4-game plan), offline
  trust copy, 0/4 state — no placeholder, no recovery screen.
- Raw: `D:\Temp\c63-boot.xml`, `c63-offline.xml`, `c63-i2.xml`,
  `c63-i3.xml` (outside Git).
