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
| **CORRECTION 2026-09-30 (Change 068) — the row above is wrong about the device backend.** It is kept verbatim as history. The original claim "verified it fails loudly at `BEGIN`" was measured on the **Node test backend only** and does not hold for the adapter that runs on the device. `adapters/expo.ts` queues every statement on one per-native-handle tail and runs the body inside the held slot, so a nested `transaction()` reached through the outer adapter is enqueued BEHIND the slot its own transaction is holding: it never reaches `BEGIN`, never rejects, and never resolves — a permanent, error-free app freeze. The `withExclusiveTransactionAsync` behavior the original row implies also no longer applies: Change 065 moved BEGIN/COMMIT to the main connection, so there is no second native connection whose `BEGIN` could reject. **Evidence that invalidated the claim:** a nested call must be rejected BEFORE enqueueing, because after enqueueing it is already deadlocked — this is the ordering the fix adopts, and `src/db/adapters/__tests__/expo.test.ts` now proves the pre-enqueue rejection against a fake native handle with a jest timeout as a hang backstop. **Repaired:** both adapters now raise one shared `SQLiteReentrantTransactionError` (`src/db/transaction-scope.ts`), keyed on the native handle / driver handle so two wrappers over one native database are one transaction scope. Severity is raised from Low (latent) to **High (latent but unrecoverable)**: no product call site nests today, but a single future call site that forgets to thread `txn` is a permanent app freeze with no error, no log line, and no recovery. Residual exposure and its owner are recorded in `.agent/KNOWN_ISSUES.md`. | adapter tests + `transaction-reentrancy` suite (13) + `storage-parity` suite |
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

**Change 068 note (2026-09-30):** "no nested call sites" was re-verified as a
static fact — all 31 non-test `transaction(` sites thread `txn`, and no
production code wraps `transaction(` in a `Promise.all` against one adapter.
It is no longer a load-bearing safety property: re-entrancy is now rejected
explicitly on both backends, so a future call site that forgets to thread `txn`
fails loudly instead of freezing the app.

## Not reproduced

Nested transaction silently rolling back the outer one (this is a **Node-backend**
symptom only: on the device the same mistake froze the app rather than rolling
back — see the corrected PASS_B row and Change 068. The Node symptom is now
impossible too, because re-entrancy is rejected on both backends before the
nested `BEGIN` can join the outer transaction); progress focus
reload race; RoundWindow interval churn; dead Replace-Import control
(it is a two-tap `ConfirmButton`); tutorial/screen timer leaks; orphan
AppState/BackHandler listeners.
