/**
 * 058: safe-back behavior — cold deep-link landings (empty stack) replace to
 * a per-route fallback instead of stranding on a bare `router.back()` no-op.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import { backOrFallback, useSafeBack } from "@/components/ui/back-link";

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn<() => boolean>(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

describe("backOrFallback", () => {
  it("goes back when the stack allows it, else falls back", () => {
    expect(backOrFallback(true)).toBe("back");
    expect(backOrFallback(false)).toBe("replace");
  });
});

describe("useSafeBack", () => {
  it("backs on a non-empty stack and never touches replace", async () => {
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValue(true);
    const { result } = await renderHook(() => useSafeBack("/progress"));
    result.current();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("replaces to the fallback on an empty stack", async () => {
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useSafeBack("/games"));
    result.current();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/games");
  });
});
