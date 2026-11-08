/**
 * 061: Countdown settles — the 50ms interval stops once the window closes
 * instead of firing setState forever on a mounted target. Shared canonical
 * copy (tap-rush + quick-compare twins deduped into game-ui).
 */
import { describe, expect, it, jest } from "@jest/globals";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import { StyleSheet } from 'react-native';
import { Colors } from '@/theme/tokens';

import { Countdown, useWindowDeadline } from "../countdown";
import { createFakeClock } from "@/sdk";

describe("Countdown settle (061)", () => {
  it('uses neutral instrumentation ink, then warning, never CTA red', async () => {
    jest.useFakeTimers();
    try {
      const clock = createFakeClock(0);
      await render(<Countdown deadlineMs={1000} windowMs={1000} clock={clock} testID="roles" />);
      expect(StyleSheet.flatten(screen.getByTestId('roles-fill').props.style).backgroundColor).toBe(Colors.light.textSecondary);
      await act(async () => { clock.advance(800); await jest.advanceTimersByTimeAsync(50); });
      expect(StyleSheet.flatten(screen.getByTestId('roles-fill').props.style).backgroundColor).toBe(Colors.light.warning);
    } finally { jest.useRealTimers(); }
  });
  it("stops ticking once remaining reaches zero", async () => {
    jest.useFakeTimers();
    try {
      const clock = createFakeClock(1_000);
      await render(
        <Countdown deadlineMs={1_100} windowMs={1_000} clock={clock} testID="cd" />,
      );
      // Advance past the deadline in tick-sized steps (inside act: each
      // tick is a React state update).
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          clock.advance(50);
          await jest.advanceTimersByTimeAsync(50);
        });
      }
      // The bar carries no text children; progress is exposed via the
      // accessibility label.
      expect(screen.getByTestId("cd").props.accessibilityLabel).toMatch(
        /0 percent/,
      );
      // Settled: further timer progress never polls the clock again.
      const nowSpy = jest.spyOn(clock, "now");
      try {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(1_000);
        });
        expect(nowSpy).not.toHaveBeenCalled();
      } finally {
        nowSpy.mockRestore();
      }
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Countdown accessibility", () => {
  it("is a timer with a coarse whole-second value and no live region", async () => {
    jest.useFakeTimers();
    try {
      const clock = createFakeClock(0);
      await render(<Countdown deadlineMs={4_200} windowMs={5_000} clock={clock} testID="a11y" label="Time left" />);
      const track = screen.getByTestId("a11y");
      expect(track.props.accessibilityRole).toBe("timer");
      expect(track.props.accessibilityLabel).toBe("Time left");
      expect(track.props.accessibilityValue).toEqual({ text: "5 seconds" });
      expect(track.props.accessibilityLiveRegion).toBeUndefined();

      // Sub-second ticks do not change the announced value.
      await act(async () => { clock.advance(150); await jest.advanceTimersByTimeAsync(150); });
      expect(screen.getByTestId("a11y").props.accessibilityValue).toEqual({ text: "5 seconds" });

      await act(async () => { clock.advance(3_100); await jest.advanceTimersByTimeAsync(3_100); });
      expect(screen.getByTestId("a11y").props.accessibilityValue).toEqual({ text: "1 second" });
    } finally { jest.useRealTimers(); }
  });

  it("keeps the legacy percent label when no label is given", async () => {
    const clock = createFakeClock(0);
    await render(<Countdown deadlineMs={500} windowMs={1_000} clock={clock} testID="legacy" />);
    expect(screen.getByTestId("legacy").props.accessibilityLabel).toBe("50 percent of the window left");
  });
});

describe("useWindowDeadline", () => {
  const setup = async (initial: { active: boolean; key: string }) => {
    const clock = createFakeClock(1_000);
    const hook = await renderHook(
      (props: { active: boolean; key: string }) => useWindowDeadline(props.active, 5_000, clock, props.key),
      { initialProps: initial },
    );
    return { clock, hook };
  };

  it("exposes now + duration while active and null while inactive", async () => {
    const { hook } = await setup({ active: false, key: "r1" });
    expect(hook.result.current).toBeNull();
    await hook.rerender({ active: true, key: "r1" });
    expect(hook.result.current).toBe(6_000);
  });

  it("freezes across an inactive span and continues from the banked remainder", async () => {
    const { clock, hook } = await setup({ active: true, key: "r1" });
    expect(hook.result.current).toBe(6_000);
    clock.advance(2_000);
    await hook.rerender({ active: false, key: "r1" });
    expect(hook.result.current).toBeNull();
    clock.advance(10_000); // paused time is never counted
    await hook.rerender({ active: true, key: "r1" });
    // 3 s of the 5 s window remain, measured from the resume instant (13 s).
    expect(hook.result.current).toBe(16_000);
  });

  it("restarts at the full window when the reset key changes", async () => {
    const { clock, hook } = await setup({ active: true, key: "r1" });
    clock.advance(4_000);
    await hook.rerender({ active: true, key: "r2" });
    expect(hook.result.current).toBe(10_000);
  });
});
