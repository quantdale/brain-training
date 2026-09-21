/**
 * Finding 2: reduced-motion consumers share ONE native subscription + seed.
 *
 * The hook used to subscribe per instance (~50 per Games screen). These tests
 * pin the shared module-level store: many consumers, one native subscription,
 * every consumer reacts to a change, late consumers read the shared value, and
 * the test-only reset tears the subscription down.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import {
  resetReducedMotionStoreForTests,
  usePrefersReducedMotion,
} from '@/components/a11y/reduced-motion';

type MotionListener = (value: boolean) => void;

function Consumer({ id }: { id: number }) {
  const reduced = usePrefersReducedMotion();
  return <Text testID={`consumer-${id}`}>{reduced ? 'reduced' : 'full'}</Text>;
}

describe('usePrefersReducedMotion shared store', () => {
  let listener: MotionListener | null = null;
  let removeSpy: jest.Mock;
  let addSpy: ReturnType<typeof jest.spyOn>;
  let seedSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    resetReducedMotionStoreForTests();
    listener = null;
    removeSpy = jest.fn();
    addSpy = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(((event: string, handler: MotionListener) => {
        if (event === 'reduceMotionChanged') {
          listener = handler;
        }
        return { remove: removeSpy };
      }) as never);
    seedSpy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    resetReducedMotionStoreForTests();
    addSpy.mockRestore();
    seedSpy.mockRestore();
  });

  it('shares one native subscription and seed across many consumers', async () => {
    await render(
      <>
        {Array.from({ length: 50 }, (_, index) => (
          <Consumer key={index} id={index} />
        ))}
      </>,
    );

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(seedSpy).toHaveBeenCalledTimes(1);
    expect(listener).not.toBeNull();
  });

  it('still reacts to native changes, and late consumers read the shared value', async () => {
    const first = await render(<Consumer id={0} />);
    expect(screen.getByTestId('consumer-0')).toHaveTextContent('full');

    await act(async () => {
      listener?.(true);
    });
    expect(screen.getByTestId('consumer-0')).toHaveTextContent('reduced');

    // A consumer mounted after the change reads the shared store immediately
    // and never opens a second native subscription.
    await first.unmount();
    await render(<Consumer id={1} />);
    expect(screen.getByTestId('consumer-1')).toHaveTextContent('reduced');
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('reset removes the native subscription and clears the store', async () => {
    await render(<Consumer id={0} />);
    resetReducedMotionStoreForTests();
    expect(removeSpy).toHaveBeenCalledTimes(1);

    await render(<Consumer id={1} />);
    expect(screen.getByTestId('consumer-1')).toHaveTextContent('full');
    expect(addSpy).toHaveBeenCalledTimes(2);
  });
});
