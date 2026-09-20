# Audit map — 060-idempotency-economy-merge-safety

**Program SHA:** `428d293` · **Predecessor:** `059-persistence-transaction-atomicity` (VALIDATED)

## Evidence chain

1. Ledger race dedupe → `db/ledger.ts` (OR IGNORE + reselect; given
   pre-validation the branch means the partial unique index fired — FK
   and trigger ABORTs still throw) · tests: forced-interleave dedupe
   (would UNIQUE-throw pre-fix) + 3-way overlap convergence + sequential
   dedupe (existing).
2. Merge-ownership pins → `cosmetics/__tests__/economy.test.ts`:
   sequential (settings-union owned, no ledger entry → `already-owned`,
   untouched) and forced-interleave (merge landing between fast-path read
   and txn). The interleave exposed a real latent charge path, closed by
   an in-txn ownership re-check in `store.ts` before the balance check
   (no charge for owned items on any path).
3. Focused suites green (db economy, cosmetics economy/hardening);
   typecheck; lint; OpenSpec strict.

## Census claims closed by design evidence (no change)

- xpAwards double-award: no live path — claim-CAS + single-txn + period
  sources; reaffirms 022 (blanket UNIQUE forbidden for repeating
  `system`/restore sources). Pinned by claim-hardening + economy
  idempotency tests.
- purchaseCosmetic TOCTOU: contradicted — both ownership directions
  return free (fast path / in-txn grant). Pinned by (2).
- Workout merge `updatedAt`: single-user row-atomic newer-wins +
  preview gating; forgery is self-inflicted. Accepted.
- Backup timestamps/forgery: strict rejection would break skewed-clock
  and retired-game restores; MAC deferred by constitution. Shape/range/FK
  boundary stays. Accepted.
- Seed FNV: runtime uses exact strings; raw JSON preserves them; INTEGER
  is a fingerprint. v13 migration disproportionate. Accepted LOW
  (deferred from 057 explicitly here).

## Residuals

- Quest mid-loop kill, snapshot tear, v12 recompute: carried (059/065).
- Cross-device backup sharing ("100% saves"): user-choice restore
  semantics, not a vulnerability.

## Boundaries

Manual/platform/store/CI per program. No UI/route/game/schema change.
