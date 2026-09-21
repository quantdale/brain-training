/**
 * 061: motion lifecycle contracts — fire-and-forget drivers stop on
 * supersede and unmount instead of accumulating on detached nodes.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { Animated, Text } from "react-native";

import { launchAnimation, usePressFeedback } from "@/components/ui/motion";
import { Tappable } from "@/components/ui/tappable";

function mockDrivers() {
  const stops: jest.Mock[] = [];
  const starts: jest.Mock[] = [];
  const timing = jest.spyOn(Animated, "timing").mockImplementation((() => {
    const stop = jest.fn();
    const start = jest.fn();
    stops.push(stop);
    starts.push(start);
    return { start, stop, reset: jest.fn() } as never;
  }) as never);
  const spring = jest.spyOn(Animated, "spring").mockImplementation((() => {
    const stop = jest.fn();
    const start = jest.fn();
    stops.push(stop);
    starts.push(start);
    return { start, stop, reset: jest.fn() } as never;
  }) as never);
  return { timing, spring, stops, starts };
}

describe("launchAnimation", () => {
  it("starts the driver and stops it on cleanup", () => {
    const start = jest.fn();
    const stop = jest.fn();
    const cleanup = launchAnimation({ start, stop } as never);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    cleanup();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("usePressFeedback drivers", () => {
  it("stops the press-in driver when press-out starts, and stops on unmount", async () => {
    const { timing, spring, stops } = mockDrivers();
    try {
      const { result, unmount } = await renderHook(() => usePressFeedback({}));
      await act(async () => {
        result.current.onPressIn();
      });
      expect(timing).toHaveBeenCalledTimes(1);
      await act(async () => {
        result.current.onPressOut();
      });
      // The press-in timing was superseded by the spring.
      expect(stops[0]).toHaveBeenCalledTimes(1);
      expect(spring).toHaveBeenCalledTimes(1);
      await unmount();
      expect(stops[stops.length - 1]).toHaveBeenCalled();
    } finally {
      timing.mockRestore();
      spring.mockRestore();
    }
  });

  it("061: rapid taps through Tappable do not crash and reset on unmount", async () => {
    const { unmount } = await render(
      <Tappable testID="press" feedback={false}>
        <Text>tap</Text>
      </Tappable>,
    );
    const node = screen.getByTestId("press");
    // Drive the real press handlers (not internal props): rapid cycles plus
    // teardown exercise the driver-stop paths (a throw here fails the test).
    await fireEvent(node, "pressIn");
    await fireEvent(node, "pressOut");
    await fireEvent(node, "pressIn");
    // The node survives the rapid cycles, and teardown actually unmounts it
    // (which is where the driver-stop path runs).
    expect(screen.getByTestId("press")).toBeOnTheScreen();
    await unmount();
    expect(screen.queryByTestId("press")).toBeNull();
  });
});
