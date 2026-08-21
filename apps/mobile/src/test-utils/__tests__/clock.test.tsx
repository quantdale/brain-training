/**
 * Tests for the `advanceTime` lockstep helper.
 *
 * Renders a probe component whose interval reads the injected FakeClock, so
 * the test proves BOTH time sources move together: jest fake timers fire the
 * interval AND the screen sees the advanced clock value.
 */
import { useEffect, useState } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFakeClock } from '@/sdk';
import type { FakeClock } from '@/sdk';

import { advanceTime } from '../clock';

function ClockProbe({ clock }: { clock: FakeClock }) {
  const [now, setNow] = useState(clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 100);
    return () => clearInterval(id);
  }, [clock]);
  return <Text testID="probe-now">{now}</Text>;
}

describe('advanceTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('advances the injected clock and jest timers in lockstep', async () => {
    const clock = createFakeClock(0);
    await render(<ClockProbe clock={clock} />);
    expect(screen.getByTestId('probe-now')).toHaveTextContent('0');

    await advanceTime(clock, 500);

    // The 100ms interval fired (fake timers moved) and the rendered value
    // reflects the advanced FakeClock (injected clock moved).
    expect(screen.getByTestId('probe-now')).toHaveTextContent('500');
    expect(clock.now()).toBe(500);
  });

  it('leaves the clock untouched for a zero advance', async () => {
    const clock = createFakeClock(1000);
    await render(<ClockProbe clock={clock} />);
    await advanceTime(clock, 0);
    expect(clock.now()).toBe(1000);
    expect(screen.getByTestId('probe-now')).toHaveTextContent('1000');
  });
});
