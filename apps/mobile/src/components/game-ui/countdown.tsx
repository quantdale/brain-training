/**
 * Countdown — the shrinking visible response-window bar for reflex games.
 *
 * Renders the fraction of the current target's response window that remains.
 * Time is always read from the monotonic `Clock` (never the wall clock); the
 * bar polls at a coarse 50 ms interval so it is smooth without burning
 * renders, settles the interval once the window closes (061), and clamps at
 * 0 (the game logic's expiry timer owns the actual resolution).
 *
 * The component is mounted only while a target is live and the game is not
 * paused, so pausing naturally freezes the bar: on resume it remounts with
 * the unchanged deadline and shows the exact remaining fraction.
 *
 * Accessibility: the track is a single `timer` element whose value is the
 * remaining time in whole seconds (rounded up). The value string only changes
 * once per second and the element is never a live region, so VoiceOver reads
 * it on focus but is not flooded by the 50 ms visual updates.
 *
 * Canonical shared copy (061): `speed-tap-rush` and `speed-quick-compare`
 * carried byte-identical twins (down to the docstring) that drifted apart
 * the moment one was repaired. Per-game copies are deleted; both games use
 * this module.
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
  /**
   * Accessible name. Defaults to the legacy percent-of-window phrasing used by
   * the reflex games; whole-second-deadline games pass a stable name such as
   * "Time left" and let the timer value carry the number.
   */
  label?: string;
}

const TICK_MS = 50;

export function Countdown({ deadlineMs, windowMs, clock, testID, label }: CountdownProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadlineMs - clock.now()),
  );

  useEffect(() => {
    // Settle at zero: a live 20Hz setState past the deadline is pure churn
    // during the reflex-critical window (the expiry timer owns resolution,
    // not this bar).
    const timer = setInterval(() => {
      const left = Math.max(0, deadlineMs - clock.now());
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadlineMs, clock]);

  const fraction = windowMs > 0 ? Math.min(1, remaining / windowMs) : 0;
  // The window turns warning-colored once less than a third remains.
  // The action accent is CTA-only; a timer is passive instrumentation.
  const fillColor = fraction < 1 / 3 ? theme.warning : theme.textSecondary;

  // Coarse, whole-second timer value: changes at most once per second.
  const wholeSeconds = Math.ceil(remaining / 1000);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={label ?? `${Math.round(fraction * 100)} percent of the window left`}
      accessibilityValue={{ text: `${wholeSeconds} ${wholeSeconds === 1 ? 'second' : 'seconds'}` }}
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

/**
 * Display-side mirror of `useGameDeadlineTimeout`'s accounting, for games
 * whose per-round deadline lives only inside that hook (no deadline in the
 * reducer). Same arguments, same semantics: the window runs while `active`,
 * is frozen (not reset) when `active` goes false, and restarts at the full
 * `durationMs` only when `resetKey` changes.
 *
 * Returns the monotonic deadline of the running window, or `null` while it
 * is not active (paused, not in the answer phase). Feed the result straight
 * into `<Countdown>` and render nothing for `null`: the bar then unmounts on
 * pause and remounts on resume at the exact remaining fraction.
 *
 * Display only — the game's own timeout hook still owns resolution. The
 * window is derived during render (React's "adjust state on prop change"
 * pattern), so the first painted frame already has the right deadline and
 * state changes only at window boundaries, never per tick.
 */
export function useWindowDeadline(
  active: boolean,
  durationMs: number,
  clock: Clock,
  resetKey: string | number,
): number | null {
  const [stored, setStored] = useState<WindowState>(() => ({
    key: resetKey,
    active,
    remainingMs: Math.max(0, durationMs),
    startedAtMs: clock.now(),
  }));

  let current = stored;
  if (current.key !== resetKey) {
    current = { key: resetKey, active, remainingMs: Math.max(0, durationMs), startedAtMs: clock.now() };
  } else if (current.active !== active) {
    current = active
      ? { ...current, active, startedAtMs: clock.now() }
      : {
          // Bank the finished active segment so the next activation continues from it.
          ...current,
          active,
          remainingMs: Math.max(0, current.remainingMs - Math.max(0, clock.now() - current.startedAtMs)),
        };
  }
  if (current !== stored) {
    setStored(current);
  }

  return active ? current.startedAtMs + current.remainingMs : null;
}

/** `remainingMs` is what was left when the current active segment began at `startedAtMs`. */
interface WindowState {
  key: string | number;
  active: boolean;
  remainingMs: number;
  startedAtMs: number;
}
