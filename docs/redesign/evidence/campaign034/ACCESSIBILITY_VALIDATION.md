# Campaign 034 accessibility validation

## Automated result

The final after-state capture set was audited with:

```text
node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign034-runtime-after2 --density 420 --json
[PASS] 0 violation(s) across 4 surface(s)
```

The four surfaces were Profile and Rewards in light and dark themes. Profile
had 4 interactive nodes and all 4 were labelled; Rewards had 1 interactive
node and it was labelled. No undersized or unlabelled controls were reported.

The scrolled XML independently exposed stable IDs and text for the lower
controls, including `profile-rewards-entry`, `profile-rewards-pending`,
`profile-data-management`, and `profile-settings`. The Rewards row carries an
accessible label and hint describing that it opens the place to claim rewards
and manage cosmetics.

## Limits

This is an automated UIAutomator audit plus XML inspection on one Android
emulator. Manual TalkBack, VoiceOver, iOS, physical-device, large-font,
reduced-motion, and independent human usability validation were not executed
and remain pending.
