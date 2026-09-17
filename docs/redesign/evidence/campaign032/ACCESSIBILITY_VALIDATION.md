# Campaign 032 accessibility validation

## Required light/dark matrix

Command:

`node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign032-runtime-after\default --density 420 --json`

Result: **PASS — 0 violations across 6 surfaces**.

| Surface | Interactive | Labelled | Undersized | Unlabelled |
| --- | ---: | ---: | ---: | ---: |
| Games light | 6 | 6 | 0 | 0 |
| Games dark | 6 | 6 | 0 | 0 |
| Game Detail light | 3 | 3 | 0 | 0 |
| Game Detail dark | 3 | 3 | 0 | 0 |
| Standalone intro light | 9 | 9 | 0 | 0 |
| Standalone intro dark | 9 | 9 | 0 | 0 |

The Games cards, search/filter affordances, Game Detail favorite/mastery/Play
controls, and intro controls retain semantic labels. The decorative identity
mark is explicitly hidden from accessibility; the adjacent family, verb, and
interaction text are the semantic identity.

The Games static captures report a visible `Cue Shift` card as clipped at the
scroll viewport boundary, but its visible height is 100dp and it is not an
undersized-target violation. This is the understood viewport-boundary behavior
already documented by the repository audit tooling.

## Exploratory capture classification

For transparency, an audit over the whole temporary directory (including
partially scrolled exploratory search XML and below-fold representative detail
XML) reported four diagnostics: one partially visible `Color Stroop` card at an
11dp capture boundary and three existing 18dp “View detailed trends for this
game” links on representative details. These are not part of the required
6-surface matrix: the first is a partially captured list row, and the latter
are the known compact trend-link findings carried from the Campaign 030B
accessibility baseline. No unlabelled control was found, and no new in-scope
semantic regression is claimed or hidden.

Manual TalkBack, text-size extremes, physical-device accessibility, and iOS
VoiceOver remain pending external/manual evidence; see
`HUMAN_VALIDATION_PENDING.md`.

