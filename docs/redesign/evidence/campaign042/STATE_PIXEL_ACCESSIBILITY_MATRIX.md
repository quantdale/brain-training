# Campaign 042 — State, Pixel, and Accessibility Matrix

**Status:** `[PASS]` for the technically reachable Android closure states;
remaining platform/human boundaries are explicit
**Date:** 2026-09-18

| State family | Evidence | Result |
| --- | --- | --- |
| Route/theme baseline | 11 routes × light/dark in `routes-final` | `[PASS]` 22/22 nonblank, route-verified, a11y violations 0 |
| Compact viewport | Home, Games, Profile, Results at density 320 | `[PASS]` 4/4 audited, 0 violations |
| Large text | Home, Games, Profile, Results at font scale 2 / density 420 | `[PASS]` 4/4 audited, 0 violations; Results CTA fully visible after repair |
| Active workout/Home | Cold release launch and post-relaunch Home | `[PASS]` workout content loaded; no targeted startup markers |
| Game intro/gameplay | Intro and gameplay for all three named representative games | `[PASS]` real mechanic and semantic controls observed |
| Completed result | Three named games, result summary/reward, final screenshot/XML | `[PASS]` result route, reward, replay/back controls visible |
| Pause/resume | Sequence Memory gameplay → pause overlay → Resume | `[PASS]` overlay visible and gameplay restored |
| Persisted settings | Favorite and dark theme, each force-stop/relaunch checked | `[PASS]` state retained; settings restored to Light/System afterward |
| Offline/relaunch | Wi-Fi/data disabled during final release relaunch runs | `[PASS]` two exact final runs returned to healthy Home |
| Empty/first-run clean state | Destructive wipe or separate clean-install matrix | `[NOT VALIDATED]` not required to reproduce the Campaign 042 defects; no destructive wipe was performed on the evidence device |
| Search/no-results and every catalog mechanic | Full catalog/state permutation | `[NOT VALIDATED]` outside the three-game closure scope |
| Export/import system document sheet | Native OS picker/share sheet | `[NOT VALIDATED]` system-sheet boundary, covered by repository portability tests only |
| iOS, VoiceOver, physical device, human manual usability | Cross-platform/human validation | `[NOT VALIDATED]` explicitly outside this Android technical certification |

The primary capture roots are:

- `D:\Temp\campaign042\release-after-repair\routes-final`
- `D:\Temp\campaign042\release-after-repair\responsive-final`
- `D:\Temp\campaign042\release-after-repair\results-repair`
- `D:\Temp\campaign042\persistence-final`
- `D:\Temp\campaign042\game`

The matrix is considered materially closed for the runtime defects named by
Campaign 042 because every affected technical state—startup, release
independence, result, large text, relaunch, pause/resume, theme, and favorite—
has direct evidence. The unvalidated rows are not hidden behind a green label.
