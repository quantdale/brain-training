/**
 * 061: useDbData supersession — a slow load overtaken by a newer bump must
 * not overwrite the fresh resolution when it finally lands.
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
