# Campaign 031 before/after evidence index

Date: 2026-09-17
Device for both packages: 1080×2400, density 420, disposable normal Android
AVD family. Campaign 030B is the immutable before baseline; its raw files were
not overwritten.

## Core visual comparison

| State | Campaign 030B before | Campaign 031 after | Structural observation |
| --- | --- | --- | --- |
| Home / Today | `D:\Temp\campaign030b-visual-baseline-verified\default\light\home.png`  `c2bbe244…020a4`  / dark `02e1f964…08f93` | Dynamic light `campaign031-runtime\light\home-fresh.png`  `979FF363…527172`; dark `dark\home-fresh-stable.png`  `19C3D7D6…02DC790` | Today’s Workout owns the first decision surface; progress/current-next context is adjacent; metrics/configuration are secondary. |
| Game intro/tutorial | Before light `3872dc4f…76b092`; dark `d8128451…6f7d` | Dynamic light `light\intro.png`  `E4DD0613…524C89`; dark `dark\intro.png`  `147C066B…9753A` | Workout position, concise mechanic, one `Start game`, tutorial/example are visible in the handoff. |
| Active gameplay | Before dynamic Cue Keeper `3d08ad62…ca221` | Dynamic light `light\gameplay-active.png`  `469CF509…90F5A`; dark `dark\gameplay-active.png`  `B5D2739E…FF9D9` | Board and essential HUD remain primary; no reward/economy competition was added. |
| Pause/resume | Before `fd715df1…76ed9` | Dynamic light `light\pause.png`  `E2547797…07856`; dark `dark\pause.png`  `78BD1F45…ECC6E` | Pause overlay remains explicit with frozen-timer copy, Resume, and Quit. |
| Result / Next | Before light `57690b5c…9a692`; dark `e26d9965…7f7b` | Dynamic light `light\result-1-force-win.png`  `104F1687…4F86`; dark `dark\result-1.png`  `03EA8F36…09EB` | Outcome/facts lead, reward is bounded, and `UP NEXT` plus one primary `Next game` is clear. |
| Final completion | Before `D:\Temp\campaign030b-flow\screen-20260917-165349.png`  `0a2bc580…c255a` | Dynamic light `light\result-final-retry.png`  `253A6DC0…7C8D5`; dark `dark\result-4.png`  `37937F42…AEDEC` | Completion is a dedicated `4/4 games complete` state with one Finish action. |
| Completed Home | Before `D:\Temp\campaign030b-flow\home-complete-20260917-1655.png`  `ef8529e6…4e55f` | Dynamic light `light\home-completed-stable.png`  `6F2AB98A…8FA85`; dark `dark\home-completed-stable.png`  `7F595884…33B30` | Home now confirms saved completion and routes to Today’s progress rather than restarting. |

Ellipses above shorten hashes only for the index; the exact hashes and byte
counts for the selected after files are below.

## Exact after artifacts

All selected PNGs are 1080×2400 and non-uniform rendered frames. Companion
UIAutomator XML files are in `D:\Temp\campaign031-runtime\hierarchy`.

| Theme | File | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| light | `light/home-fresh.png` | `979FF363F45496ED3AAD5C20FB03F6DD1F6BC340810C61B37978F02F2B527172` | 191774 |
| light | `light/intro.png` | `E4DD0613E6232A60AEBD02510405FE5417770C17C8A729BBD3D73F5494524C89` | 236793 |
| light | `light/gameplay-active.png` | `469CF509D5A3835681A5DA975554DE39B637CE04390C1C879DA1327905D90F5A` | 83688 |
| light | `light/pause.png` | `E25477972FB360B3D602B2809EDDE6847DC4DC93A019E58A2F4FB49897E07856` | 56165 |
| light | `light/result-1-force-win.png` | `104F16872DFEC1BAA9A63E259CF7EA3D4EC360201B4F224631F4A839D6946F86` | 185145 |
| light | `light/result-final-retry.png` | `253A6DC06E00DA00ED4127A9B6390B48F8234F986D08E50CD7EDFF0E2D37C8D5` | 183523 |
| light | `light/home-completed-stable.png` | `6F2AB98A2F36E92F268E5F362EEE4B39B4A6601A76552245ED11C0A48E68FA85` | 212693 |
| dark | `dark/home-fresh-stable.png` | `19C3D7D6183063389D37ACCFF170AA9433339861A00D81146D614A88602DC790` | 179338 |
| dark | `dark/intro.png` | `147C066CB7CCA0DDE82083C13C2653E8F6D2901F7697C6C005830081AFF9753A` | 227404 |
| dark | `dark/gameplay-active.png` | `B5D2739E032B53E7EA2407A651F10C332E1848BB4FC72EEFDA2BB645878FF9D9` | 82190 |
| dark | `dark/pause.png` | `78BD1F45D6D0520E42310EA011F9607FCF58F3DBF4D45527CFCFDC56E5AECC6E` | 57683 |
| dark | `dark/result-1.png` | `03EA8F36ADECD5EC362B238C0384FF37C259DB362A651945DFB6A443605209EB` | 180915 |
| dark | `dark/result-4.png` | `37937F428FB7BB0E7BC79C8F1C34F6EEA65C225FFBF9592DEEBEA4C916BAEDEC` | 179558 |
| dark | `dark/home-completed-stable.png` | `7F5958845A2E29A2F5F08CB2FE341E15DC3748BCD6AECC06040E209202B33B30` | 192772 |

## Final static capture

`node scripts/qa/ui-capture.mjs --device emulator-5562 --out
D:\Temp\campaign031-static-capture --surfaces home,game-intro,results
--theme light,dark` produced 6/6 captures with `blank: false` and
`routeVerified: true`. Home and Results are valid final changed-surface
captures in both themes. The direct `/game/memory` route was recorded at the
repository’s explicit `game-not-ready-loading` boundary because it lacked a
persisted workout launch tuple; it is not used to claim the dynamic intro.
The stateful dynamic captures above are the equivalent real-pixel evidence for
the actual workout handoff.
