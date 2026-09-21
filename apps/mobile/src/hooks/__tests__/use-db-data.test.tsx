/**
 * 061: useDbData supersession — a slow load overtaken by a newer bump must
 * not overwrite the fresh resolution when it finally lands.
 * Hardening: a deps change must drop the previous payload in the same render
 * pass, so a same-route param change never paints stale data for one tick.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useDbData } from "@/hooks/use-db-data";

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
