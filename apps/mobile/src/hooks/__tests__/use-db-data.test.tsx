/**
 * 061: useDbData supersession — a slow load overtaken by a newer bump must
 * not overwrite the fresh resolution when it finally lands.
 * Hardening: a deps change must drop the previous payload in the same render
 * pass, so a same-route param change never paints stale data for one tick.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useDbData, type DbDataResult } from "@/hooks/use-db-data";
import { expectConsoleNoise } from "@/test-utils";

jest.mock("@/db", () => ({
  getDb: () => ({}),
}));

describe("useDbData supersession (061)", () => {
  it("keeps the newest scheduled load when an older one resolves late", async () => {
    let releaseSlow!: (value: string) => void;
    const slowGate = new Promise<string>((resolve) => {
      releaseSlow = resolve;
    });
    let generation = 0;
    const load = (): Promise<string> => {
      generation += 1;
      if (generation === 1) {
        return slowGate;
      }
      return Promise.resolve("fresh");
    };

    const { result, rerender } = await renderHook(
      ({ token }: { token: number }) => useDbData(load, [token], "fallback"),
      { initialProps: { token: 0 } },
    );
    // Supersede before the slow load resolves.
    await rerender({ token: 1 });
    await waitFor(() => expect(result.current.data).toBe("fresh"));
    // The stale load lands late and must be ignored.
    await act(async () => {
      releaseSlow("stale");
    });
    await act(async () => {});
    expect(result.current.data).toBe("fresh");
    expect(result.current.loaded).toBe(true);
  });
});

describe("useDbData deps-change reset (hardening)", () => {
  it("drops the previous payload and loading flag when deps change", async () => {
    const pending: ((value: string) => void)[] = [];
    const load = (): Promise<string> =>
      new Promise<string>((resolve) => {
        pending.push(resolve);
      });

    const { result, rerender } = await renderHook(
      ({ token }: { token: number }) => useDbData(load, [token], "fallback"),
      { initialProps: { token: 0 } },
    );

    await act(async () => {
      pending[0]("first");
    });
    await waitFor(() => expect(result.current.data).toBe("first"));
    expect(result.current.loaded).toBe(true);

    // Same-route param change: the render pass that observes the new token
    // must already have dropped the old payload.
    await rerender({ token: 1 });
    expect(result.current.data).toBe("fallback");
    expect(result.current.loaded).toBe(false);
    expect(pending).toHaveLength(2);

    await act(async () => {
      pending[1]("second");
    });
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(result.current.loaded).toBe(true);
  });
});

/**
 * 072: the seam must REPORT a failed read as a failure, not as an empty
 * success.
 *
 * The defect is invisible in the hook's own output — `loaded` was true and
 * `error` was set in both cases — and only became a user-facing wrong screen at
 * the consumer. These tests pin the new `status` so the distinction lives in the
 * return value, and pin that a retry actually re-runs the load.
 */
describe("useDbData failure reporting (072)", () => {
  it("reports 'error' with a fallback payload, never 'empty' or 'success'", async () => {
    const load = jest.fn(async () => {
      throw new Error("db unavailable");
    });
    // The console.error is the production log task 1.3 asks for; the repo's
    // console gate requires deliberate output to be scoped explicitly, and the
    // scope must WRAP THE RENDER because the effect fires during it.
    type ErrorHook = { result: { current: DbDataResult<string> } };
    let hook: ErrorHook | null = null;
    await expectConsoleNoise(/\[useDbData\] test-load load failed/, async () => {
      // SAFETY: the harness satisfies the AppDatabase shape; the load never
      // touches it because it rejects first.
      hook = await renderHook(() =>
        useDbData<string>(load as never, [], "FALLBACK", {
          isEmpty: (v) => v.length === 0,
          label: "test-load",
        }),
      );
      await waitFor(() => expect(hook?.result.current.failed).toBe(true));
    });
    const { result } = hook as unknown as ErrorHook;

    expect(result.current.status).toBe("error");
    // The critical assertion: the fallback is NOT presented as real data.
    expect(result.current.data).toBe("FALLBACK");
    expect(result.current.loaded).toBe(true);
    expect((result.current.error as Error).message).toBe("db unavailable");
  });

  it("distinguishes a successful-but-empty result from a failure", async () => {
    const { result } = await renderHook(() =>
      useDbData<string[]>(async () => [], [], ["FALLBACK"], {
        isEmpty: (v) => v.length === 0,
        label: "empty-test",
      }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBe("empty");
    expect(result.current.failed).toBe(false);
  });

  it("reports 'success' for a non-empty result", async () => {
    const { result } = await renderHook(() =>
      useDbData<string[]>(async () => ["a"], [], [], {
        isEmpty: (v) => v.length === 0,
        label: "success-test",
      }),
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBe("success");
    expect(result.current.data).toEqual(["a"]);
  });

  it("starts in 'loading' and never paints the fallback as loaded", async () => {
    let release!: (v: string[]) => void;
    const gate = new Promise<string[]>((resolve) => {
      release = resolve;
    });
    const { result } = await renderHook(() =>
      useDbData<string[]>(() => gate, [], ["FALLBACK"], { isEmpty: (v) => v.length === 0 }),
    );
    expect(result.current.status).toBe("loading");
    expect(result.current.loaded).toBe(false);
    await act(async () => {
      release(["real"]);
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBe("success");
  });

  it("retry() re-runs a failed load and can succeed", async () => {
    let attempt = 0;
    const load = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("transient");
      return ["recovered"];
    });
    type RetryHook = { result: { current: DbDataResult<string[]> } };
    let hook: RetryHook | null = null;
    await expectConsoleNoise(/\[useDbData\] retry-test load failed/, async () => {
      hook = await renderHook(() =>
        useDbData<string[]>(load as never, [], [], {
          isEmpty: (v) => v.length === 0,
          label: "retry-test",
        }),
      );
      await waitFor(() => expect(hook?.result.current.failed).toBe(true));
    });
    const result = (hook as unknown as RetryHook).result;
    expect(result.current.data).toEqual([]);

    await act(async () => {
      result.current.retry();
    });
    // A retry that does not actually re-run the load is the worst outcome: the
    // user taps "Try again" and the screen sits on the same failure.
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(["recovered"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("retry() clears the previous error before the new attempt settles", async () => {
    // The load must HANG on the second attempt, otherwise the failure re-lands
    // inside the same act() and the intermediate state is unobservable — which
    // would make this test pass or fail on timing rather than on behavior.
    let attempt = 0;
    let releaseSecond!: (v: string[]) => void;
    const secondGate = new Promise<string[]>((resolve) => {
      releaseSecond = resolve;
    });
    const load = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("still broken");
      return secondGate;
    });
    type FailHook = { result: { current: DbDataResult<string[]> } };
    let hook: FailHook | null = null;
    await expectConsoleNoise(/\[useDbData\] retry-fail load failed/, async () => {
      hook = await renderHook(() =>
        useDbData<string[]>(load as never, [], [], {
          isEmpty: (v) => v.length === 0,
          label: "retry-fail",
        }),
      );
      await waitFor(() => expect(hook?.result.current.failed).toBe(true));
    });
    const result = (hook as unknown as FailHook).result;

    await act(async () => {
      result.current.retry();
    });
    // Mid-flight the screen is LOADING, not still showing the old failure. A
    // retry that leaves the previous error on screen tells the user nothing
    // changed, which is worse than showing the error again.
    expect(result.current.status).toBe("loading");
    expect(result.current.failed).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {
      releaseSecond(["ok"]);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });
});
