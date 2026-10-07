/**
 * 061: Countdown settles — the 50ms interval stops once the window closes
 * instead of firing setState forever on a mounted target. Shared canonical
 * copy (tap-rush + quick-compare twins deduped into game-ui).
 */
import { describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet } from 'react-native';
import { Colors } from '@/theme/tokens';

import { Countdown } from "../countdown";
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
