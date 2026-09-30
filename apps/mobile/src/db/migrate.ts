import type { SQLiteAdapter } from './adapter';
import {
  CANONICAL_TRIGGER_DDL,
  MIGRATIONS,
  REQUIRED_JOURNAL_MODE,
  SCHEMA_VERSION,
  SQL,
  type Migration,
} from './schema';

/**
 * Migration runner driven by `PRAGMA user_version`.
 *
 * Each pending migration is applied inside its own transaction together with
 * the `user_version` bump: a failure rolls the DDL back and leaves the
 * database at the previous version (and still usable). Re-running against an
 * already-migrated database is a no-op.
 */

/** Current schema version recorded in the database, 0 for a fresh database. */
export async function getSchemaVersion(adapter: SQLiteAdapter): Promise<number> {
  const row = await adapter.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export interface RunMigrationsOptions {
  /** Override the migration set (tests use this to inject failures). */
  migrations?: readonly Migration[];
  /** Migrate only up to this version (defaults to SCHEMA_VERSION). */
  targetVersion?: number;
}

export async function runMigrations(
  adapter: SQLiteAdapter,
  options: RunMigrationsOptions = {},
): Promise<void> {
  const migrations = [...(options.migrations ?? MIGRATIONS)];
  const target = options.targetVersion ?? SCHEMA_VERSION;

  // Migrations must be a well-formed ordered sequence: unique versions > 0.
  migrations.sort((a, b) => a.version - b.version);
  for (let i = 0; i < migrations.length; i++) {
    if (migrations[i].version <= 0) {
      throw new Error(`Migration version must be > 0 (got ${migrations[i].version})`);
    }
    if (i > 0 && migrations[i].version === migrations[i - 1].version) {
      throw new Error(`Duplicate migration version ${migrations[i].version}`);
    }
  }
  const current = await getSchemaVersion(adapter);

  // Task 8.2: Reject if database has newer schema than code supports
  if (current > target) {
    throw new Error(
      `Database schema version ${current} is newer than supported version ${target}. ` +
      `Cannot open database with older code. Please update the application.`
    );
  }

  // A negative user_version cannot be produced by this runner; seeing one means
  // header corruption. Treat the database as unopenable rather than silently
  // replaying the whole migration chain over live data.
  if (!Number.isInteger(current) || current < 0) {
    throw new Error(
      `Database schema version ${current} is corrupt (expected a non-negative integer).`
    );
  }

  const pending = migrations.filter((m) => m.version > current && m.version <= target);

  // 059: the applied range must be gap-free. Without this, a gappy set
  // would silently skip a version while user_version advances past it,
  // leaving the database reporting a version whose objects were never
  // created. Single-migration custom sets (e.g. a lone v6 over a v5
  // database) and partial targets keep working — only versions inside the
  // range this run would apply are required to be contiguous. Fail fast
  // before touching the database.
  if (pending.length > 0) {
    const applied = new Set(pending.map((m) => m.version));
    const maxApplied = Math.max(...applied);
    for (let v = current + 1; v <= maxApplied; v++) {
      if (!applied.has(v)) {
        throw new Error(
          `Migration set gap: missing version ${v} inside the applied range ` +
            `(${current + 1}..${maxApplied}). Versions applied by one run must be contiguous.`,
        );
      }
    }
  }

  for (const migration of pending) {
    await adapter.transaction(async (txn) => {
      await migration.up(txn);
      // user_version lives in the database header, so the bump is part of the
      // same transaction as the DDL and rolls back with it.
      await txn.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/**
 * Re-create every schema guard (append-only / CHECK / INTEGER-storage
 * trigger) that is currently missing. `IF NOT EXISTS` makes existing guards
 * a cheap no-op, so this is safe on every boot.
 *
 * Why this exists: the replace-import and wipe paths temporarily DROP the
 * append-only triggers at connection level to clear their tables, then
 * recreate them in a `finally`. A process kill between the drop and the
 * recreate leaves the database permanently without its guards, and no
 * migration would ever restore them (schema version unchanged). Re-checking
 * the derived canonical set on startup closes that crash window.
 */
export async function ensureSchemaGuards(adapter: SQLiteAdapter): Promise<void> {
  const present = await adapter.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'trigger'",
  );
  const existing = new Set(present.map((r) => r.name));
  for (const ddl of CANONICAL_TRIGGER_DDL) {
    const name = /IF NOT EXISTS (\w+)/.exec(ddl)?.[1];
    if (name && !existing.has(name)) {
      await adapter.exec(ddl);
    }
  }
}

/** One connection invariant and the value the app requires it to hold. */
export interface ConnectionInvariant {
  name: string;
  apply: string;
  probe: string;
  /** Value the invariant must hold; `null` means "must be a number > 0". */
  equals: number | string | null;
  /**
   * Additional values that are correct for a purely in-memory database, where
   * the setting has no file to apply to. Empty for invariants that behave
   * identically either way.
   */
  inMemoryAccepts: readonly string[];
  describe: (value: unknown) => string;
}

/**
 * The connection-level invariants every backend must satisfy, in apply order
 * (Change 068).
 *
 * These are asserted rather than assumed. The audit found the device running
 * with `busy_timeout = 0` and an implicit rollback journal because no pragma
 * was ever issued for them, and the test backend could not see the difference
 * because it inherits a different driver default. A setting that is applied but
 * never read back is the same defect with an extra line of code, so
 * `initializeConnection` fails startup rather than proceeding on an assumption.
 */
export const CONNECTION_INVARIANTS: readonly ConnectionInvariant[] = [
  {
    name: 'foreign_keys',
    apply: SQL.foreignKeysOn,
    probe: SQL.foreignKeysProbe,
    equals: 1,
    inMemoryAccepts: [],
    describe: (v) => String(v),
  },
  {
    name: 'busy_timeout',
    apply: SQL.busyTimeout,
    probe: SQL.busyTimeoutProbe,
    // `null` = "must be a number greater than zero". A timeout of 0 means
    // "fail instantly", which is the device's inherited default and the exact
    // divergence being closed, so a hardcoded expectation would be a weaker
    // check than "the app's stated requirement is in force".
    equals: null,
    inMemoryAccepts: [],
    describe: (v) => String(v),
  },
  {
    name: 'journal_mode',
    apply: SQL.journalModeWal,
    probe: SQL.journalModeProbe,
    equals: REQUIRED_JOURNAL_MODE,
    // A `:memory:` database has no file, so SQLite has nowhere to put a WAL and
    // `memory` is the only value it can possibly report. Treating that as a
    // violation would mean the invariant could not be asserted at all for the
    // entire test suite — the assertion is the point, so the exception is
    // explicit and narrow instead of the check being disabled.
    inMemoryAccepts: ['memory'],
    describe: (v) => String(v),
  },
  {
    name: 'synchronous',
    apply: SQL.synchronousNormal,
    probe: SQL.synchronousProbe,
    // 1 = NORMAL. `FULL` (2) is SQLite's default and forces an fsync on every
    // commit; with WAL already providing crash-atomicity, NORMAL is the
    // standard companion and is asserted rather than assumed. Reported as the
    // integer SQLite's probe returns, so the expectation is the engine's own
    // encoding rather than a name it may not echo back.
    equals: 1,
    inMemoryAccepts: [],
    describe: (v) => String(v),
  },
] as const;

/** One invariant whose effective value did not meet the requirement. */
export interface ConnectionInvariantViolation {
  invariant: string;
  expected: string;
  actual: string;
}

/** Normalize a probed pragma value for comparison and reporting. */
function normalizeInvariantValue(value: unknown): string {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value === null || value === undefined) return 'null';
  // Drivers disagree on pragma row shape (column name and numeric type), so
  // read the first value in the row: the comparison must depend on the
  // engine's answer, not on which driver produced it.
  if (typeof value === 'object') {
    const first = Object.values(value as Record<string, unknown>)[0];
    return normalizeInvariantValue(first);
  }
  return String(value);
}

/**
 * True when the `main` database has no backing file.
 *
 * `PRAGMA database_list` reports an empty `file` column for a `:memory:`
 * database and a path for a file-backed one. This is the engine's own answer
 * rather than an assumption about how the adapter was constructed, so a future
 * backend that opens a different kind of store is classified correctly.
 */
export async function isInMemoryDatabase(adapter: SQLiteAdapter): Promise<boolean> {
  const rows = await adapter.all<{ name: string; file: string | null }>('PRAGMA database_list');
  const main = rows.find((r) => r.name === 'main') ?? rows[0];
  if (!main) return false;
  return main.file === null || main.file === undefined || main.file === '';
}

/** Read one invariant's effective value; null when the probe returns no row. */
async function probeInvariant(
  adapter: SQLiteAdapter,
  invariant: ConnectionInvariant,
): Promise<string | null> {
  const row = await adapter.get<Record<string, unknown>>(invariant.probe);
  if (row === null) return null;
  return normalizeInvariantValue(row);
}

/**
 * True when `actual` (already normalized) satisfies `invariant`.
 *
 * `inMemory` widens only the explicitly declared `inMemoryAccepts` values; it
 * never relaxes `foreign_keys` or `busy_timeout`, which the app needs in both
 * modes.
 */
export function invariantSatisfied(
  invariant: ConnectionInvariant,
  actual: string,
  inMemory = false,
): boolean {
  if (invariant.equals === null) {
    const numeric = Number(actual);
    return Number.isFinite(numeric) && numeric > 0;
  }
  if (inMemory && invariant.inMemoryAccepts.includes(actual)) return true;
  return actual === normalizeInvariantValue(invariant.equals);
}

/**
 * Connection-level pragmas every database needs before migrations run, plus a
 * read-back assertion (Change 068).
 *
 * Applying a pragma is not evidence that it took effect: an open transaction, a
 * busy database, or a runtime that does not implement the setting can all turn
 * `PRAGMA journal_mode = WAL` into a silently ignored statement. The read-back
 * is what makes the invariant real, and the throw is deliberate — continuing on
 * a connection that silently lost foreign-key enforcement or lock tolerance
 * would trade a loud startup failure for a quiet data-integrity bug later.
 */
export async function initializeConnection(adapter: SQLiteAdapter): Promise<void> {
  const violations: ConnectionInvariantViolation[] = [];
  // Resolved once from the engine itself, before the loop, so a probe failure
  // cannot leave different invariants judged against different notions of what
  // kind of database this is.
  const inMemory = await isInMemoryDatabase(adapter);

  for (const invariant of CONNECTION_INVARIANTS) {
    try {
      await adapter.exec(invariant.apply);
    } catch (error) {
      violations.push({
        invariant: invariant.name,
        expected: `the statement to apply (${invariant.apply})`,
        actual: `it threw: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    // `journal_mode` answers with the mode the engine actually chose, so the
    // probe — not the statement we sent — is the authoritative read.
    const actual = await probeInvariant(adapter, invariant);
    if (actual === null) {
      violations.push({
        invariant: invariant.name,
        expected: 'a probeable effective value',
        actual: 'the probe returned no row',
      });
      continue;
    }
    if (!invariantSatisfied(invariant, actual, inMemory)) {
      violations.push({
        invariant: invariant.name,
        expected:
          invariant.equals === null
            ? 'a value greater than zero'
            : normalizeInvariantValue(invariant.equals),
        actual: invariant.describe(actual),
      });
    }
  }

  if (violations.length > 0) {
    const details = violations
      .map((v) => `  - ${v.invariant}: expected ${v.expected}, got ${v.actual}`)
      .join('\n');
    throw new Error(
      'Database connection invariants not satisfied. The app relies on these ' +
        'connection-level settings, so it refuses to start rather than run on an ' +
        `unverified connection:\n${details}`,
    );
  }
}
