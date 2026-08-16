import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { initializeConnection, runMigrations } from '../migrate';

/** Fresh in-memory database migrated to SCHEMA_VERSION (Node backend). */
export async function createMigratedDb(): Promise<SQLiteAdapter> {
  const adapter = createNodeSqliteAdapter(':memory:');
  await initializeConnection(adapter);
  await runMigrations(adapter);
  return adapter;
}
