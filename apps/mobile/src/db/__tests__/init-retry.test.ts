/**
 * 059: failed init passes close what they opened — bootstrap retry after a
 * migration/profile failure must never stack native connections.
 * 065: init is idempotent — a repeated success returns the SAME instance and
 * never opens a second adapter, concurrent calls share one pass, and a failed
 * pass stays retryable (its promise is cleared, the singleton is not set).
 */
import { describe, expect, it, jest } from "@jest/globals";
import type { SQLiteAdapter } from "../adapter";
import { createNodeSqliteAdapter } from "../adapters/node";

/**
 * `initDatabase` memoizes a module-level singleton, so every case loads a
 * fresh copy of the module with an isolated registry (the pattern of
 * `data-portability/__tests__/file-transport.lazy.test.ts`) and starts from
 * "never initialized". Without this, a success in an earlier case would
 * short-circuit the later ones through the 065 idempotence guard.
 */
function importFreshDbIndex(): typeof import("../index") {
  let mod!: typeof import("../index");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../index") as typeof import("../index");
  });
  return mod;
}

function trackable(
  inner: SQLiteAdapter,
  hooks: { closed: number; failExecTimes: number },
): SQLiteAdapter {
  return {
    exec: async (sql: string) => {
      if (hooks.failExecTimes > 0) {
        hooks.failExecTimes -= 1;
        throw new Error("injected open failure");
      }
      return inner.exec(sql);
    },
    run: (sql, params) => inner.run(sql, params),
    get: (sql, params) => inner.get(sql, params),
    all: (sql, params) => inner.all(sql, params),
    transaction: (fn) => inner.transaction(fn),
    close: async () => {
      hooks.closed += 1;
      return inner.close();
    },
  };
}

describe("initDatabase retry hygiene (059) and idempotence (065)", () => {
  it("closes a failed pass adapter and retries clean on a fresh one", async () => {
    const { initDatabase } = importFreshDbIndex();
    const hooks = { closed: 0, failExecTimes: 1 };
    let opened = 0;
    const createAdapter = (): SQLiteAdapter => {
      opened += 1;
      return trackable(createNodeSqliteAdapter(":memory:"), hooks);
    };

    await expect(initDatabase({ createAdapter })).rejects.toThrow(
      /injected open failure/,
    );
    expect(opened).toBe(1);
    expect(hooks.closed).toBe(1);

    const db = await initDatabase({ createAdapter });
    expect(opened).toBe(2);
    expect(hooks.closed).toBe(1); // success path closes nothing
    expect(await db.workouts.countCompleted()).toBe(0);
  });

  it("returns the same instance on a repeated success and never re-opens", async () => {
    const { initDatabase, getDb } = importFreshDbIndex();
    let opened = 0;
    const createAdapter = (): SQLiteAdapter => {
      opened += 1;
      return createNodeSqliteAdapter(":memory:");
    };

    const first = await initDatabase({ createAdapter });
    const second = await initDatabase({ createAdapter });

    // 065: a post-success retry must reuse the live connection instead of
    // opening a second one (which would leak the first and split the queue).
    expect(second).toBe(first);
    expect(getDb()).toBe(first);
    expect(opened).toBe(1);
    expect(await second.workouts.countCompleted()).toBe(0);
  });

  it("coalesces concurrent startup calls into one in-flight pass", async () => {
    const { initDatabase } = importFreshDbIndex();
    let opened = 0;
    const createAdapter = (): SQLiteAdapter => {
      opened += 1;
      return createNodeSqliteAdapter(":memory:");
    };

    const [first, second] = await Promise.all([
      initDatabase({ createAdapter }),
      initDatabase({ createAdapter }),
    ]);

    expect(second).toBe(first);
    expect(opened).toBe(1);
  });
});
