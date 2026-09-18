# Campaign 048 Route and Resource Sample

The current release package was exercised through a bounded route set after
the startup sample:

| Surface | Result | Raw artifact |
| --- | --- | --- |
| Home | rendered in all three cold-start cycles | `D:\Temp\campaign048-release-content-cycle1.png` (and cycles 2–3) |
| Games | heading and catalog cards rendered | `D:\Temp\campaign048-games.png` |
| Progress | populated 44-session view rendered | `D:\Temp\campaign048-progress.png` |
| Profile | local player, XP, streak, and coin state rendered | `D:\Temp\campaign048-profile.png` |
| Memory detail | detail card, Play Memory CTA, and records rendered | `D:\Temp\campaign048-memory-detail.png` |

## Memory snapshots

After returning to Home, three `dumpsys meminfo --package` snapshots at
five-second intervals reported:

| Sample | Total PSS | Total RSS | Views |
| --- | ---: | ---: | ---: |
| 1 | 247,176 KB | 356,016 KB | 2,251 |
| 2 | 246,168 KB | 355,000 KB | 2,251 |
| 3 | 246,696 KB | 355,544 KB | 2,251 |

The short sample showed no monotonic growth. These are emulator observations,
not a release memory ceiling.

The existing Campaign 045 release matrix remains the broader route evidence:
12 light/dark surfaces, nonblank and route-verified, with zero technical
accessibility violations.
