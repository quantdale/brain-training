import type { SQLiteAdapter } from './adapter';
import { CANONICAL_TRIGGER_DDL, MIGRATIONS, SCHEMA_VERSION, SQL, type Migration } from './schema';

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

/** Connection-level pragmas every database needs before migrations run. */
export async function initializeConnection(adapter: SQLiteAdapter): Promise<void> {
  await adapter.exec(SQL.foreignKeysOn);
}
