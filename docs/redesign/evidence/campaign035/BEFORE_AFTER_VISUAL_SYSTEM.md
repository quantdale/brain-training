# Campaign 035 before/after visual evidence

## Capture provenance

The before set was captured on the dedicated `emulator-5554` Android AVD at
`D:\Temp\campaign035-runtime-before` with
`node scripts/qa/ui-capture.mjs --device emulator-5554 --out D:\Temp\campaign035-runtime-before --surfaces home,games,game-detail,progress,profile,rewards,results,game-intro --theme light,dark --settle-ms 800`.
It contains 16 route-verified, nonblank captures across the eight requested
surfaces and two themes. The before manifest is
`D:\Temp\campaign035-runtime-before\manifest.json`.

The after changed-surface capture is under
`D:\Temp\campaign035-runtime-after`; matching warm artifacts used for the
visual and accessibility review are under
`D:\Temp\campaign035-runtime-after-warm`. The warm directory contains
Game Detail plus the lazily-loaded GameHost intro in both light and dark.

The first automated GameHost capture on each route was a real route-verified
loading state while Metro compiled the lazy game module. It is retained as
evidence of the cold-load behavior, but is not presented as the final intro
visual. The after warm artifacts were obtained after the module rendered and
contain `memory.intro` in their XML.

## Matching Game Detail pixels

All four Game Detail images are 1080x2400 PNGs. A read-only pixel comparison
produced these results:

| Theme | Before dominant hero fill | After dominant hero fill | Changed pixels | RMSE |
| --- | --- | --- | ---: | ---: |
| Light | `(252,231,243)` domain soft pink, 848,040 px | `(255,255,255)` neutral raised surface, 1,259,437 px | 47.86% | 36.32 |
| Dark | `(58,29,46)` domain soft maroon, 848,039 px | `(37,30,68)` neutral raised surface, 860,949 px | 45.00% | 35.36 |

The large changed area is expected: it is the hero fill and border treatment,
not a layout rewrite. In the inspected images, the magenta/pink identity mark
and `Repeat / Recall` cue remain visible, while the red/coral Play button is
the only strong action accent.

### Exact image hashes

| Artifact | SHA-256 |
| --- | --- |
| Before light `D:\Temp\campaign035-runtime-before\default\light\game-detail.png` | `A6C2CD596E1B6680C9512FBB7447A4471A9DB4825782724F0B038B4398AE84C8` |
| After light `D:\Temp\campaign035-runtime-after\default\light\game-detail.png` | `F45FD0B8BD414F4B6FE3A6E64CB157E6631312FA58AA0C298C96A1CED04E888D` |
| Before dark `D:\Temp\campaign035-runtime-before\default\dark\game-detail.png` | `BA1257713B2DAC58B348DB7C0703B7E35D448D2CF7ECB6FD0E8E62E5DF2DD9D6` |
| After dark `D:\Temp\campaign035-runtime-after\default\dark\game-detail.png` | `66009A8B42B8153042DD6ADA4D1D816D10DD413720FB79E2121CE51C96CBF2A2` |
| Warm after light `D:\Temp\campaign035-runtime-after-warm\default\light\game-intro.png` | `5D21B3592063F15957A7BC1AA38431A377358FA958E96776BD267D4518125236` |
| Warm after dark `D:\Temp\campaign035-runtime-after-warm\default\dark\game-intro.png` | `3B74DC5E51CBF0CB05638BFA30FA91F5B80F09CFBB0D950F87963081B6BF05F3` |

## GameHost warm comparison limits

The retained warm before artifact is
`D:\Temp\campaign035-runtime-before\default\light\game-intro-warm.png`.
Its dominant palette is dark (`(58,29,46)`), despite being stored below the
light directory because the manual warm capture followed the harness theme
sequencing. The initial before dark manifest artifact is the cold loading
screen. Therefore the warm GameHost before/after image comparison is treated
as an observed dark-output comparison only, not as a claimed light baseline.
The after light and dark warm outputs are separately captured and inspected.
