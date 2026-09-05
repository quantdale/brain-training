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

## Dispositions — Phase 1 debt triage (2026-09-05)

- **C-01 CLOSED as proven-safe, reclassified NON-BLOCKING MAINTENANCE (was
  Medium).** Adversarial audit (see VALIDATION "XP idempotency proof"): the
  only production writers into `xp_awards` are `achievements/rewards.ts:73`,
  `quests/rewards.ts:82`, `streaks/actions.ts:148`. Each runs inside one
  serialized DB transaction (`BEGIN IMMEDIATE` node / exclusive-txn expo) and
  is gated by a CAS claim (`UPDATE ... WHERE claimed_at IS NULL` / in-txn
  claimedMilestones check) that is the commit point; the paired currency half
  is additionally schema-guarded by `idx_currency_ledger_operation_id`.
  Retries, double-taps, and concurrent claim-all passes provably land
  exactly-once (69 tests green incl. crash-after-insert rollback and racing
  claim-all suites). A schema `UNIQUE(source)` would be actively WRONG:
  `data-portability/apply.ts` documents legacy/generic awards (e.g.
  `source='system'`) that legitimately repeat, so the constraint would turn
  merge/replace restores into unrecoverable insert failures — the "fix" would
  introduce a restore-corruption blocker. No legitimate-award collision is
  constructible: namespaces `achievement:` / `quest:<id>:<period>` /
  `milestone:` are disjoint one-shot keys.
- **C-02 CLOSED as NON-BLOCKING (Low retained).** The offline validator gap is
  purely static-analysis coverage: `apps/mobile/src` contains zero runtime
  network-API call sites (grep over src), and the authoritative proof is the
  in-jest suite that replaces `fetch`/`XMLHttpRequest`/`WebSocket` with
  throwers, failing at the exact call site on any use. Real-airplane-mode
  device proof is scheduled under C-15. A regex-hardening fix would add
  churn without closing a runtime escape; documented trade-off stands.
- **C-03 CLOSED as NON-BLOCKING MAINTENANCE ×3.** Provenance-allowlist dead
  entries: identity-adjacent config, deliberately inert by design (permanent
  exemptions cannot become silent bypass); touching it risks more than it
  gains. Seeding mock seam: test-fixture noise only — startup catch is
  intended, logged, non-fatal; production facade is complete. QA artifact
  retention: 700+ gitignored transient run dirs; no release impact; retention
  sweep belongs with store-build automation. All three deferred with rationale.
## Dispositions

(Filled during execution; every row closed with evidence pointer or honest
classification before campaign closure.)
