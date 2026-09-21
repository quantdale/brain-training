# Post-067 hardening — Pass B (runtime / lifecycle / persistence / recovery / perf)

**Method:** independent read-only critic plus focused suites and two
opt-in perf probes on the same host as the committed baselines.

## Fixed

| Finding | Severity | Fix | Proof |
|---|---|---|---|
| Cold deep link into a game stranded the user: all 42 screens ended with a bare `router.back()` and GameHost consumes hardware back, so Quit/Done was a no-op on an empty stack | High | all 42 screens use the shared `useSafeBack('/games')` (`router.replace('/games')` when `canGoBack()` is false); catalog guard test fails on any reintroduced bare `router.back()` | game suites 357/357; `memory` integration test (replace on empty stack, back otherwise); **device proof** on the hardening artifact: deep link → game → pause → Quit landed on Games |
| Progression sync ran unthrottled on every Home/Profile/Rewards focus (bounded 5000-sample eval + ~30 idempotent upserts) | Medium | new `progression/focus-sync.ts`: input-aware throttle (newest-session fingerprint or >5 s window) + in-flight dedupe; Profile reuses the last snapshot on throttled loads | `focus-sync` unit tests + Home/Profile/Rewards integration tests (rapid focus syncs once; completion still visible) |
| Per-control reduced-motion subscription (~50 native subscriptions per Games screen) | Low | one module-level subscription + shared listener set behind the same hook API | 50-consumer test proves 1 subscription and reactive updates |
| Persistence invoked inside a `setState` updater (concurrent discarded renders could double-persist) | Low | compute next settings outside the updater; StrictMode test pins one persist per toggle | settings tests |
| Adapter does not pre-reject nested `transaction()` | Low (latent) | verified it fails loudly at `BEGIN` without corrupting the outer transaction; no product call site nests. Recorded, no code change | adapter tests |
| Perf: projection/snapshot costs at 20k sessions | — | re-measured on the same host: projection 13.61 ms (committed 13.89), snapshot 158.4 ms (committed 138.7, within the documented cross-process spread) — no regression; export heap amplification fixed in Pass A | probe run + committed baselines |

## Verified clean

Transactions/concurrency (queue held for the whole transaction, ROLLBACK
always attempted, no nested call sites); idempotency/double-apply paths
(session completion, ledger, claims, cosmetics, reroll, advance);
lifecycle cleanup (countdown settles, intervals/timeouts, AppState,
animations, toast queue, confirm-button arm timers, `useDbData`
generation guard); persistence/recovery (per-migration transaction +
contiguity, schema-guard heal, corrupt JSON degradation, import
validation incl. FK references).

## Not reproduced

Nested transaction silently rolling back the outer one; progress focus
reload race; RoundWindow interval churn; dead Replace-Import control
(it is a two-tap `ConfirmButton`); tutorial/screen timer leaks; orphan
AppState/BackHandler listeners.
