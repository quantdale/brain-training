# Campaign 035 accessibility validation

Command:

`node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign035-runtime-after-warm --density 420 --json`

Result: **PASS — 0 violations across 4 surfaces.**

| Surface | Interactive | Labelled | Undersized | Unlabelled | Clipped |
| --- | ---: | ---: | --- | --- | --- |
| default/light/game-detail | 3 | 3 | none | none | none |
| default/dark/game-detail | 3 | 3 | none | none | none |
| default/light/game-intro | 9 | 9 | none | none | none |
| default/dark/game-intro | 9 | 9 | none | none | none |

The XML also retains semantic IDs/labels for the Game Detail Back, Play,
favorite, identity, mechanic, mastery, and records controls, and for the
GameHost identity mark, difficulty choices, Start game, QA toggle, tutorial
demo, and tutorial skip. The automated audit is not a substitute for manual
TalkBack, large-text, reduced-motion, or VoiceOver review; those remain
pending as recorded in `HUMAN_VALIDATION_PENDING.md`.

