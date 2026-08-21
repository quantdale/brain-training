/**
 * In-memory database fixture for tests outside `src/db`.
 *
 * Mirrors `src/db/__tests__/helpers.ts` (same Node backend, same migration
 * chain) so other modules do not have to import across another module's
 * `__tests__` directory. The Node SQLite adapter is a test-only backend and
 * is never bundled into the app.
 */
import { initializeConnection, runMigrations } from '@/db';
import type { SQLiteAdapter } from '@/db';
import { createNodeSqliteAdapter } from '@/db/adapters/node';

/** Fresh in-memory database migrated to SCHEMA_VERSION (Node backend). */
export async function createMigratedDb(): Promise<SQLiteAdapter> {
  const adapter = createNodeSqliteAdapter(':memory:');
  await initializeConnection(adapter);
  await runMigrations(adapter);
  return adapter;
}
