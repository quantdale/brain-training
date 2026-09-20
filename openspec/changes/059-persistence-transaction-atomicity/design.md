# Design — 059-persistence-transaction-atomicity

## CAS reroll (`db/workout.ts`)

```ts
export class WorkoutWriteConflictError extends Error {
  constructor(key: string) {
    super(`workout changed under reroll for key ${key}: refresh and retry`);
    this.name = "WorkoutWriteConflictError";
  }
}
```

In `applyReroll`, add an optional `expected?: RerollBaseline` snapshot
(the hook passes the row it selected from; direct callers omit it and fall
back to this call's fresh read). First compare canonical list forms in JS
— this detects real list moves (reconcile substitution) while never
spuriously failing on hand-edited non-canonical storage, which
canonicalizes identically on both sides. Then extend the `WHERE` with the
baseline attempt + index (a concurrent advance shifts the positional merge
base; a concurrent reroll bumps the attempt):

```sql
UPDATE workout_instances
SET game_ids_json = ?, reroll_attempt = ?, updated_at = ?
WHERE date = ? AND reroll_attempt = ? AND current_index = ?
```

List mismatch or `changes === 0` → throw. The empty-row guard (056) stays
first. The paid path (`paidReroll` → txn-bound repo) inherits CAS; a
conflict rolls back the debit atomically (note: same-attempt paid overlap
resolves earlier as silent operationId dedupe — CAS covers advance-races
with fresh operationIds). `use-workout` reroll wraps both apply paths:
catch `WorkoutWriteConflictError` → `refresh()` → rethrow for a user
retry (existing surfacing: paid-debit failures already propagate the same
way; there is no auto-retry). Sequential callers always read fresh, so
they are unaffected.

## Close-on-failure init (`db/index.ts`)

```ts
export interface AppDatabaseOptions {
  ...
  createAdapter?: () => SQLiteAdapter; // default: expo opener (tests inject)
}

async function initializeDatabase(options) {
  const createAdapter = options.createAdapter ?? (() =>
    createExpoSqliteAdapter(openExpoDatabase(APP_DATABASE_NAME)));
  const adapter = createAdapter();
  try {
    ... existing pass ...
    instance = app;
    return app;
  } catch (error) {
    await adapter.close().catch(() => {});
    throw error;
  }
}
```

Success path untouched (no instance reuse — tests rely on fresh DBs).

## Contiguity (`db/migrate.ts`)

After sort + dup checks:

After the sort/dup checks and the `current` read, require every version
in `(current, maxApplicable]` to be present (fail fast naming the gap,
before any write). Single-migration custom sets (lone v6 over v5) and
partial targets keep working — only the range the run would apply must be
contiguous. Shipped `MIGRATIONS` passes trivially (also pinned by the
set-sanity test).

## Janitor (`db/workout.ts` + wiring)

```ts
export async function deleteEmptyWorkoutInstances(adapter: SQLiteAdapter): Promise<number> {
  const rows = await adapter.all<{ date: string; game_ids_json: string }>(
    "SELECT date, game_ids_json FROM workout_instances");
  const empty = rows.filter((r) => {
    try {
      const parsed = JSON.parse(r.game_ids_json);
      return !Array.isArray(parsed) || parsed.filter((g) => typeof g === "string").length === 0;
    } catch { return true; }
  });
  if (empty.length === 0) return 0;
  await adapter.transaction(async (txn) => {
    for (const r of empty) await txn.run("DELETE FROM workout_instances WHERE date = ?", [r.date]);
  });
  return empty.length;
}
```

Wired in `initializeDatabase` after `ensureSchemaGuards` (count ignored
at runtime; evidence in tests/STATE). Empty means zero playable games —
definitionally corrupt (import rejects, selection never creates);
deletion preserves all healthy history. Note: mirror `rowToInstance`'s
string-filter so the janitor and the reader agree on "empty".

## Deliberately unchanged (evidence in audit-map)

Trigger flow (boot-heal tested), quest fan-out (idempotent + resync),
export lock (consistency), v12 repair (accepted), snapshot tear
(accepted LOW), legacy advance/persistRepaired (deterministic), read-txn
support (interface boundary).
