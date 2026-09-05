# Audit Map — Campaign 022

| ID | Severity | Area | Required action |
|---|---|---|---|
| C-01 | Medium | `xp_awards` idempotency semantics (tracked debt) | Full write-path + adversarial audit; fix with migration/tests or documented-proof reclassification. |
| C-02 | Medium | Offline validator heuristic gap (tracked debt) | Prove no runtime network escape or fix; classify honestly. |
| C-03 | Low | Allowlist dead entries, seeding seam, QA retention | Classify RELEASE RELEVANT / NON-BLOCKING / FALSE-OBSOLETE; disposition with rationale. |
| C-04 | High | Release artifact authenticity | Clean prebuild → release Gradle build → manifest/permission/ABI/version inspection with SHA-256. |
| C-05 | High | Standalone runtime | Release APK must launch and be usable with no Metro on the dedicated AVD. |
| C-06 | High | Broad game certification | Registry-wide autobot certification beyond six canaries; failures investigated, never skipped. |
| C-07 | High | Workout V3 runtime | Daily + focus domains, resume, double-payment, provenance under process death. |
| C-08 | High | Lifecycle/process death | Torture matrix; duplicate-write/stale-timer/negative-duration checks. |
| C-09 | High | SQLite integrity | integrity_check, FK checks, migration replay, large corpus, malformed fixtures. |
| C-10 | High | Backup/restore equivalence | Device round-trip state comparison + adversarial archives. |
| C-11 | Medium | Accessibility | Tree audit across surfaces; TalkBack classified honestly (never PASS from statics). |
| C-12 | Medium | SAF/system sheets | App-side vs system-sheet evidence separated; manual steps documented. |
| C-13 | Medium | Physical device | Use authorized hardware or record NOT VALIDATED. |
| C-14 | Medium | Performance soak | Launch/progression/memory/timer/statement accumulation checks. |
| C-15 | Medium | Offline-first proof | All primary flows with device network disabled. |
| C-16 | Medium | Security/privacy boundary | Permissions, logs, export contents, secret scan on artifacts. |
| C-17 | Low | iOS capability | Runtime only with macOS; else compile smoke + NOT VALIDATED. |
| C-18 | High | Final-head truth | Full matrix + all four workflows green at exact final SHA; release matrix + verdict. |

## Dispositions

(Filled during execution; every row closed with evidence pointer or honest
classification before campaign closure.)
