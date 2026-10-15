# Actual native confirmation geometry

ARTEMIS Pro `872ded85-fcb7-471e-858c-fcf327b15a70`, checkerOFF, terminal
COMPLETED4800.4s. Installed source624a5a77/native09,
APK `0afcb24919fc881bdce73a3d148549ebef1d9e7bbd63098d7b10cd6068487a9c`.
This was a non-writing Load/Preview/arm-only journey; Data07 had already
qualified actual restore writes. No second tap applied an armed confirmation.

Root preserved the actual controller-created XML/PNG files from
`/sdcard/trace_c077` after terminal status, parsed their bytes and replayed the
same red-capable bounds probe that fails the original native07 reflow. Each
before XML has enabled `Apply replace import`; each after XML has enabled
`Tap again to erase and restore. Apply replace import` on the same resource ID.

| Profile | Resting native bounds | Armed native bounds | Actual probe |
|---|---|---|---|
| Default420dpi/font1 |84,244→996,370|84,244→996,370|PASS|
| Compact540dpi/font1,320dp |108,1568→972,1730|108,1568→972,1784|PASS|
|420dpi/font2 |84,2114→996,2251|84,2114→996,2346|PASS|

All three preserve x1/y1/x2 and the original resting tap center. Height growth
is permitted and does not move the action to another wrapped row. Merge remains
its separate full-width row. The XML files, hashes and exact verdicts are in
ignored `qa-artifacts/campaign077/runtime-confirmation09/`.

Root actually viewed all six before/after PNGs. **Only compact's armed PNG shows
the armed label.** Default and font2 after PNGs show expired resting labels,
despite valid armed XML from the earlier instant. They are not accepted as
armed visual evidence, and the controller's broader PNG self-report is rejected.
The native XML qualifies geometry in all three profiles; compact additionally
has actual visible armed-label proof. No additional restore/arming is required
to turn expired screenshots into a stronger claim.

The controller exceeded the intended default two-attempt cap: four attempts
were reported, including stale-position misses and extra diagnostic taps.
These are controller deviations, not app failures or a new restore. Compact and
font2 used one arm tap each. Initial expired/stale captures are invalid evidence;
they are not relabeled green. A Profile tap near Sound effects missed its target;
root viewed step38 showing System selected/Sound effectsON/HapticsON unchanged.

The task reports restored1080×2400/density420/font1/motion1/1/1/System and Home
186XP49coins. There is no `notes/output.md`; the final notes are actually in
external `notes/replace_geometry_proof.md`. No stderr file was present, and the
stdout ends with normal shutdown. No automatic checkerPASS is claimed.

Independent preserved SQLite copies immediately before and after this journey:
integrityok, all13 application tables have **identical full unordered rows**,
including8sessions/settings/workouts/ledger. The settings raw SHA remains
`a50813e8b2f4cf43007e4974865a96f85f080e8db3b32d006edee347b9cc2ec9`.
Oct15 workout is stillactive/index0; Oct14active/index2. This independently
qualifies the non-writing/preservation boundary.
