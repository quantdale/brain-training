# Campaign 050 External Boundaries

| Evidence class | Verdict | Classification |
| --- | --- | --- |
| GitHub Actions at current activation SHA | NOT VALIDATED / EXTERNAL | Runs 35394095322, 35394095221, 35394095217, and 35394095140 at SHA `5a4441d92339c723c91ea95549c581372de17822` completed with failure before runner steps; App CI job reported `steps: []`. Campaign 044's account/payment-policy diagnosis remains applicable. |
| Human TalkBack/VoiceOver | NOT VALIDATED | Automated hierarchy and label/target audit only; no independent human traversal |
| Physical Android/OEM | NOT VALIDATED | Dedicated API 35 emulator only |
| iOS/VoiceOver | NOT VALIDATED | No macOS/iOS runtime lane in scope |
| Production/store signing | NOT VALIDATED | Candidate APK is debug-signed |
| Android system share/document provider | PARTIAL | Share sheet reachability and cancellation passed; import Files surface appeared but provider ANR prevented a clean human/provider usability claim |
| Human copy/medical-claim review | PASS for repository scan | User-facing copy scan found neutral training/activity language; matches were implementation comments/tests and neutral explanatory text, with no unsupported efficacy, diagnostic, treatment, IQ, or disease-prevention claim |

These boundaries are reasons for a conditional release verdict, not evidence to
be converted into local PASS claims. No workflow, CI, store, signing, or
platform workaround was introduced.
