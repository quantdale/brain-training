# Design — Campaign 043

## Evidence order

Use current reproducible runtime observation first, then persisted-state/
SQLite evidence, executable tests and validators, source/configuration,
build/package behavior, external GitHub/API evidence, and only then history or
prior documentation. Cross-check ARTEMIS observations with deterministic
screenshots, hierarchies, logs, source, or persisted state.

## Release-boundary matrix

| Boundary | Required proof | Honest limit |
| --- | --- | --- |
| Release APK | fresh build, hash/metadata, install, Metro-free launch, core routes, relaunch, logs | local release signing is not store signing |
| Android system UI | discover actual export/import/share/document surfaces; cancel and safe return | system-sheet human usability is separate |
| Technical accessibility | hierarchy/focus/labels on representative routes if executable | automation is not human TalkBack UX certification |
| Physical Android | authorized device inventory and bounded smoke only if explicitly automation-owned | arbitrary attached hardware is not evidence |
| iOS/VoiceOver | genuine authorized iOS environment only | Windows host cannot imply iOS runtime |
| Human validation | exact uncoached handoff with no invented findings | agent automation is not an independent participant |
| Signing/store | inspect config and local artifact boundary without secrets | no owner-held credential means no store claim |

## Repair gate

If a current defect is reproduced, minimize it, add focused regression proof,
make the smallest fix, and rerun the affected release/runtime checks. If only
external/manual evidence is unavailable, record it and continue to Campaign
044; do not wait indefinitely.
