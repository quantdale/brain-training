# Campaigns 043–050 Overnight Handoff

Updated 2026-09-19. This handoff records only evidence actually collected;
external, human, and platform boundaries remain explicit.

| Campaign | Status | Evidence / boundary |
| --- | --- | --- |
| 043 | `CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING` | Android release/runtime and technical accessibility evidence passed; physical Android, iOS/VoiceOver, human TalkBack, store signing, and human usability remain unavailable. |
| 044 | `CAMPAIGN_044_ACCOUNT_OR_POLICY_EXTERNAL` | GitHub jobs failed before steps because of account/payment policy; local workflow checks remained sound and no workflow workaround was made. |
| 045 | `CAMPAIGN_045_COMPLETE` | Expo patch alignment, repository gates, Android debug/release, Metro-free launch, 12 route/theme captures, and technical a11y passed. |
| 046 | `CAMPAIGN_046_COMPLETE` | All 42 game IDs covered through lifecycle stages; 44 persisted sessions across 42 games; SQLite and focused persistence checks passed; eight-domain mechanic canaries recorded. |
| 047 | `CAMPAIGN_047_COMPLETE` | Migration/portability tests, disposable rollback/import fixtures, device export/load, valid merge/replace previews, malformed-input rejection, and a clean release relaunch sample passed. |
| 048 | `CAMPAIGN_048_COMPLETE` | Opt-in 5k/20k probes passed; three release cold-start cycles rendered Home; Games/Progress/Profile/Memory detail rendered; bounded memory and app-only logcat checks were clean; no speculative optimization was made. |
| 049 | `CAMPAIGN_049_COMPLETE` | Post-fix compact and font-scale-2 matrices passed 24/24 route-verified/nonblank captures with 0 measured target/name violations. A reproduced large-font native-tab label collision was repaired and rerun. Human screen-reader, physical/iOS, store-signing, and human system-sheet boundaries remain explicit. |
| 050 | `CAMPAIGN_050_RELEASE_CONDITIONAL` | Terminal integrated candidate at runtime source `d67aba5`: local gates, sequential debug/release builds, direct Metro-free launch after bounded recovery, four-game workout/persistence, two standalone games, invalid-route recovery, 24 current matrix captures, separate zero-violation audits, and performance probes passed. First-install ARTEMIS app ANR and Android Files-provider import ANR are retained; import usability, human/platform, store/iOS, and external-CI lanes remain unvalidated/external. |

Raw screenshots, XML dumps, databases, and generated probe output remain under
`D:\Temp` or the repository's existing evidence locations unless explicitly
listed in a tracked evidence packet. Campaign 050 packet:
`docs/redesign/evidence/campaign050/`; ARTEMIS trace:
`D:\Tools\artemis\traces\b1b2be3a-6801-430b-b336-e89fda68f567`.
