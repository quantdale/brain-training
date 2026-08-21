/**
 * Countdown — the shrinking visible window of the Tap Rush game.
 *
 * Renders the fraction of the current target's response window that remains.
 * Time is always read from the monotonic `Clock` (never the wall clock); the
 * bar polls at a coarse 50 ms interval so it is smooth without burning
 * renders, and clamps at 0 once the window closes (the game logic's expiry
 * timer owns the actual resolution).
 *
 * The component is mounted only while a target is live and the game is not
 * paused, so pausing naturally freezes the bar: on resume it remounts with
 * the unchanged deadline and shows the exact remaining fraction.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Clock } from '@/sdk';

export interface CountdownProps {
  /** Monotonic clock value by which the target must be tapped. */
  deadlineMs: number;
  /** Full window duration in ms (drives the bar's total width). */
  windowMs: number;
  /** Monotonic clock; injected so tests can advance deterministically. */
  clock: Clock;
  /** Semantic testID of the track; the fill shares it plus `-fill`. */
  testID: string;
}

const TICK_MS = 50;

export function Countdown({ deadlineMs, windowMs, clock, testID }: CountdownProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadlineMs - clock.now()),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(Math.max(0, deadlineMs - clock.now()));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadlineMs, clock]);

  const fraction = windowMs > 0 ? Math.min(1, remaining / windowMs) : 0;
  // The window turns warning-colored once less than a third remains.
  const fillColor = fraction < 1 / 3 ? theme.warning : theme.accent;

  return (
    <View
      testID={testID}
      accessibilityLabel={`${Math.round(fraction * 100)} percent of the window left`}
      style={[styles.track, { backgroundColor: theme.border }]}>
      <View
        testID={`${testID}-fill`}
        style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: fillColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
