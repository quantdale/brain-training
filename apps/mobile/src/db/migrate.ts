import type { SQLiteAdapter } from './adapter';
import { MIGRATIONS, SCHEMA_VERSION, SQL, type Migration } from './schema';

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
  const pending = migrations.filter((m) => m.version > current && m.version <= target);

  for (const migration of pending) {
    await adapter.transaction(async (txn) => {
      await migration.up((sql) => txn.exec(sql));
      // user_version lives in the database header, so the bump is part of the
      // same transaction as the DDL and rolls back with it.
      await txn.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/** Connection-level pragmas every database needs before migrations run. */
export async function initializeConnection(adapter: SQLiteAdapter): Promise<void> {
  await adapter.exec(SQL.foreignKeysOn);
}
