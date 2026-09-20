/**
 * 059: failed init passes close what they opened — bootstrap retry after a
 * migration/profile failure must never stack native connections.
 */
import { describe, expect, it } from "@jest/globals";
import type { SQLiteAdapter } from "../adapter";
import { createNodeSqliteAdapter } from "../adapters/node";
import { initDatabase } from "../index";

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

describe("initDatabase retry hygiene (059)", () => {
  it("closes a failed pass adapter and retries clean on a fresh one", async () => {
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
});
