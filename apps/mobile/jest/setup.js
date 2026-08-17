/**
 * Test environment setup (jest-expo, Node environment).
 *
 * The production `initDatabase()` opens the canonical store through the Expo
 * SQLite backend (`@/db/adapters/expo`), whose native module (`NativeDatabase`)
 * is unavailable in the Node test environment — it throws
 * "_ExpoSQLite.default.NativeDatabase is not a constructor". The documented
 * design is that Node tests run against `adapters/node.ts`, so route the Expo
 * backend through the Node adapter here. This lets the real root layout
 * initialize a working in-memory database under jest (required to validate
 * task 8.4 storage-unavailable behavior without faking green), while production
 * keeps the real Expo backend untouched.
 */
jest.mock('@/db/adapters/expo', () => {
  const node = jest.requireActual('@/db/adapters/node');
  return {
    createExpoSqliteAdapter: () => node.createNodeSqliteAdapter(':memory:'),
    openExpoDatabase: () => ({}),
  };
});
