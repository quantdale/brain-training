# Campaign 036 accessibility validation

Command:

`node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign036-runtime-after --density 420 --json`

Result: **PASS — 0 violations across 14 core light/dark surfaces.**

The after XML retains semantic IDs and labels for the new Home trust line,
Start workout action, Rewards Collection explanation/count, and Data
Management storage summary, as well as the existing controls on the other
routes. The audit output included existing off-screen/clipped candidates in
some long Games/Profile content, but they did not meet the configured
violation criteria and no new undersized or unlabelled control was introduced
by this slice.

This automated audit is not a substitute for manual TalkBack, large-text,
reduced-motion, VoiceOver, or physical-device review. Those evidence classes
remain pending in `HUMAN_VALIDATION_PENDING.md`.

