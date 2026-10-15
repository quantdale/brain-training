/**
 * A live motion-policy change must release a held control's native scale.
 *
 * The hook, Tappable, Animated.Value, and reduced-motion store stay real. Only
 * the native drivers are deterministic: start writes the requested target,
 * while finish/stop are explicit so both active and settled presses are covered.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { resetReducedMotionStoreForTests } from '@/components/a11y/reduced-motion';
import { PRESS_SCALE } from '@/components/ui/motion';
import { Tappable } from '@/components/ui/tappable';

function mockDrivers() {
  const records: {
    value: Animated.Value;
    stop: jest.Mock<() => void>;
    finish: () => void;
  }[] = [];
  const create = (value: Animated.Value | Animated.ValueXY, target: unknown) => {
    if (!(value instanceof Animated.Value) || typeof target !== 'number') {
      throw new Error('This press feedback harness expects a scalar animation');
    }
    let completion: Parameters<Animated.CompositeAnimation['start']>[0];
    const stop = jest.fn(() => {
      completion?.({ finished: false });
      completion = undefined;
    });
    records.push({
      value,
      stop,
      finish: () => {
        completion?.({ finished: true });
        completion = undefined;
      },
    });
    return {
      start: (callback) => {
        completion = callback;
        value.setValue(target);
      },
      stop,
      reset: jest.fn(),
    } satisfies Animated.CompositeAnimation;
  };
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(
    (value, config) => create(value, config.toValue),
  );
  const spring = jest.spyOn(Animated, 'spring').mockImplementation(
    (value, config) => create(value, config.toValue),
  );
  return { records, timing, spring };
}

/** Read the real scalar node that the caller supplied to its native driver. */
function currentScale(value: Animated.Value): number {
  return (value as Animated.Value & { __getValue: () => number }).__getValue();
}

describe('press feedback policy transitions through Tappable', () => {
  let nativeMotionChange: ((reduced: boolean) => void) | null;
  let initialReducedMotion: boolean;
  let addSpy: ReturnType<typeof jest.spyOn>;
  let seedSpy: ReturnType<typeof jest.spyOn>;
  let drivers: ReturnType<typeof mockDrivers>;

  beforeEach(() => {
    resetReducedMotionStoreForTests();
    nativeMotionChange = null;
    initialReducedMotion = false;
    addSpy = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
      ((event: string, listener: (value: boolean) => void) => {
        if (event === 'reduceMotionChanged') nativeMotionChange = listener;
        return { remove: jest.fn() };
      }) as never,
    );
    seedSpy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
      async () => initialReducedMotion,
    );
    drivers = mockDrivers();
  });

  afterEach(() => {
    resetReducedMotionStoreForTests();
    addSpy.mockRestore();
    seedSpy.mockRestore();
    drivers.timing.mockRestore();
    drivers.spring.mockRestore();
  });

  const policyCases: ['disabled' | 'reduced motion', boolean][] = [
    ['disabled', false],
    ['disabled', true],
    ['reduced motion', false],
    ['reduced motion', true],
  ];

  it.each(policyCases)('restores scale when %s changes after a held press (settled=%s)', async (policy, settled) => {
    const content = (disabled = false) => (
      <Tappable testID="press-policy" disabled={disabled} feedback={false}>
        <Text>Continue</Text>
      </Tappable>
    );
    const view = await render(content());
    await fireEvent(screen.getByTestId('press-policy'), 'pressIn');
    const press = drivers.records[0];
    expect(currentScale(press.value)).toBe(PRESS_SCALE.surface);
    if (settled) press.finish();

    if (policy === 'disabled') {
      await view.rerender(content(true));
      expect(screen.getByTestId('press-policy').props.accessibilityState.disabled).toBe(true);
    } else {
      expect(nativeMotionChange).not.toBeNull();
      await act(async () => nativeMotionChange?.(true));
    }

    // No press-out is required: disabling can prevent that event, and a live
    // reduced-motion preference must take effect while the finger is still held.
    expect(currentScale(press.value)).toBe(1);
    if (!settled) expect(press.stop).toHaveBeenCalledTimes(1);
    expect(drivers.spring).not.toHaveBeenCalled();
  });

  it('keeps normal press/release animated and activation immediate', async () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await render(
      <Tappable testID="press-policy" feedback={false} onPress={onPress}
        onPressIn={onPressIn} onPressOut={onPressOut}>
        <Text>Continue</Text>
      </Tappable>,
    );
    await fireEvent(screen.getByTestId('press-policy'), 'pressIn');
    const press = drivers.records[0];
    expect(currentScale(press.value)).toBe(PRESS_SCALE.surface);
    await fireEvent.press(screen.getByTestId('press-policy'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId('press-policy'), 'pressOut');
    expect(currentScale(press.value)).toBe(1);
    expect(drivers.spring).toHaveBeenCalledTimes(1);
    expect(press.stop).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('starts no scale drivers under an existing reduced-motion preference', async () => {
    initialReducedMotion = true;
    const onPress = jest.fn();
    const onPressOut = jest.fn();
    await render(
      <Tappable testID="press-policy" feedback={false} onPress={onPress} onPressOut={onPressOut}>
        <Text>Continue</Text>
      </Tappable>,
    );
    await fireEvent(screen.getByTestId('press-policy'), 'pressIn');
    await fireEvent.press(screen.getByTestId('press-policy'));
    await fireEvent(screen.getByTestId('press-policy'), 'pressOut');
    expect(drivers.records).toHaveLength(0);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});
