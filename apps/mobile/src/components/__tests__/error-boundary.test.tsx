/**
 * ErrorBoundary tests (task 10.5).
 *
 * Proves:
 *  1) A crash is captured and diagnostics (error + component stack) reach the
 *     onError callback, with a retry affordance rendered.
 *  2) Retry remounts the crashed subtree with a FRESH component identity
 *     rather than re-rendering the same still-mounted crashing component.
 *     The child's constructor runs only on a new instantiation (a genuine
 *     remount), not when an existing instance is re-rendered, so counting it
 *     is the discriminating signal. No persisted progression is touched by
 *     the boundary.
 *
 * Note: RNTL v14 `render`/`fireEvent` are async and must be awaited.
 */
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorBoundary } from '../error-boundary';

interface Tracker {
  instances: number;
}

/**
 * Throws every render. Counts genuine instances in the constructor, which runs
 * on each new instantiation regardless of the render throwing (and does NOT
 * run when an existing instance is merely re-rendered) — the discriminating
 * signal for a real remount.
 */
class CrashOnMount extends Component<{ tracker: Tracker }, { crash: boolean }> {
  constructor(props: { tracker: Tracker }) {
    super(props);
    props.tracker.instances += 1;
  }

  override state = { crash: true };

  override render(): ReactNode {
    if (this.state.crash) {
      throw new Error('flaky render failure');
    }
    return null;
  }
}

describe('ErrorBoundary', () => {
  let rendererErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    rendererErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    const calls = rendererErrorSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call: unknown[]) => String(call[0]).startsWith('Caught error:'))).toBe(true);
    rendererErrorSpy.mockRestore();
  });

  it('captures diagnostics and renders retry on a crash', async () => {
    const onError = jest.fn();
    const tracker: Tracker = { instances: 0 };
    await render(
      <ErrorBoundary onError={onError}>
        <CrashOnMount tracker={tracker} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toBe('flaky render failure');
    expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');

    expect(screen.getByTestId('error-boundary-retry')).toBeOnTheScreen();
  });

  it('retry remounts the crashed subtree with a fresh identity', async () => {
    const onError = jest.fn();
    const tracker: Tracker = { instances: 0 };
    await render(
      <ErrorBoundary onError={onError}>
        <CrashOnMount tracker={tracker} />
      </ErrorBoundary>,
    );

    // At least one instance was created on the initial (crashing) render
    // (React may retry the errored render, so we compare relative growth).
    const beforeRetry = tracker.instances;
    expect(beforeRetry).toBeGreaterThanOrEqual(1);

    // Press retry: the reset-key bump MUST force a fresh mount of the subtree,
    // creating at least one NEW instance. Without the reset-key remount, React
    // would re-render the same instance and instances would NOT grow — so
    // growth here is the discriminating signal for task 10.5.
    await fireEvent.press(screen.getByTestId('error-boundary-retry'));
    expect(tracker.instances).toBeGreaterThan(beforeRetry);

    // The remounted (still-crashing) child faults again, so the fallback with
    // retry is shown once more and diagnostics fire again.
    expect(onError.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('error-boundary-retry')).toBeOnTheScreen();
  });
});