/**
 * Screen-reader focus helpers — rendered contract (campaign 011 W14).
 *
 * Pins the campaign-009 grid-nav/PauseOverlay reachability root cause: focus
 * requests MUST travel through `AccessibilityInfo.sendAccessibilityEvent`
 * (RN 0.86's renderer-routed API that accepts the host instance from a ref).
 * The legacy `setAccessibilityFocus(reactTag)` takes a NUMERIC tag; feeding
 * it the ref's object instance silently no-ops on Fabric/Android, so the
 * assistive cursor never moved onto Resume and TalkBack users were stranded
 * behind the pause overlay. Retry callbacks are queued explicitly here so the
 * contract stays deterministic without entering React 19's async act/timer
 * interaction.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { type RefObject } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { requestAccessibilityFocus, useInitialA11yFocus } from '@/components/a11y/focus';

const RETRY_DELAY_MS = 250;
type TimerCallback = () => void;

function HostTarget({ targetRef }: { targetRef: RefObject<View | null> }) {
  return <View ref={targetRef} testID="focus-target" />;
}

function HookTarget({ active }: { active: boolean }) {
  const ref = useInitialA11yFocus<View>(active);
  return <View ref={ref} testID="hook-target" />;
}

describe('requestAccessibilityFocus', () => {
  let sendSpy: ReturnType<typeof jest.spyOn>;
  let legacySpy: ReturnType<typeof jest.spyOn>;
  let timeoutSpy: ReturnType<typeof jest.spyOn>;
  let pendingTimers: TimerCallback[];

  beforeEach(() => {
    pendingTimers = [];
    sendSpy = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => undefined as unknown as void);
    legacySpy = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => undefined as unknown as void);
    timeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerCallback) => {
      pendingTimers.push(callback);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
    sendSpy.mockRestore();
    legacySpy.mockRestore();
  });

  function runNextRetry(): void {
    const callback = pendingTimers.shift();
    expect(callback).toBeDefined();
    callback?.();
  }

  it('routes the focus event through the renderer API with the mounted host instance', async () => {
    const targetRef: RefObject<View | null> = { current: null };
    await render(<HostTarget targetRef={targetRef} />);
    expect(targetRef.current).not.toBeNull();

    requestAccessibilityFocus(targetRef);

    // Immediate attempt, addressed to the mounted instance with eventType
    // 'focus' — this identity check is the regression pin: the pre-fix code
    // called setAccessibilityFocus(<object>) instead.
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0]).toBe(targetRef.current);
    expect(sendSpy.mock.calls[0][1]).toBe('focus');
    expect(legacySpy).not.toHaveBeenCalled();
  });

  it('retries immediately + twice at 250ms intervals, then stops', async () => {
    const targetRef: RefObject<View | null> = { current: null };
    await render(<HostTarget targetRef={targetRef} />);

    requestAccessibilityFocus(targetRef);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), RETRY_DELAY_MS);

    runNextRetry();
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(pendingTimers).toHaveLength(1);

    runNextRetry();
    expect(sendSpy).toHaveBeenCalledTimes(3);
    expect(pendingTimers).toHaveLength(0);
  });

  it('honors a custom attempt budget', async () => {
    const targetRef: RefObject<View | null> = { current: null };
    await render(<HostTarget targetRef={targetRef} />);

    requestAccessibilityFocus(targetRef, 1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('stops retrying once the ref detaches (unmount)', async () => {
    const targetRef: RefObject<View | null> = { current: null };
    const { unmount } = await render(<HostTarget targetRef={targetRef} />);

    requestAccessibilityFocus(targetRef);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    unmount();
    // react-test-renderer does not clear external refs synchronously on
    // unmount; production React nulls them during commit deletion. Simulate
    // the detached state at the exact seam the retry loop reads.
    targetRef.current = null;

    runNextRetry();
    // Only the initial attempt ever fired; pending retries saw the detached
    // ref and bailed out instead of focusing a dead node.
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(pendingTimers).toHaveLength(0);
  });

  it('is a no-op for an already-detached ref', async () => {
    const detached: RefObject<View | null> = { current: null };
    requestAccessibilityFocus(detached);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});

describe('useInitialA11yFocus', () => {
  let sendSpy: ReturnType<typeof jest.spyOn>;
  let timeoutSpy: ReturnType<typeof jest.spyOn>;
  let pendingTimers: TimerCallback[];

  beforeEach(() => {
    pendingTimers = [];
    sendSpy = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => undefined as unknown as void);
    timeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerCallback) => {
      pendingTimers.push(callback);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
    sendSpy.mockRestore();
  });

  it('requests focus when `active` turns true and not before', async () => {
    const { rerender } = await render(<HookTarget active={false} />);
    expect(sendSpy).not.toHaveBeenCalled();

    await rerender(<HookTarget active={true} />);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    // The focused handle is the mounted host instance of the target view.
    // RNTL queries return a separate TestInstance wrapper, so compare the
    // stable semantic testID rather than object identity.
    const focused = sendSpy.mock.calls[0][0] as { props?: { testID?: string } } | null;
    expect(focused).toBeTruthy();
    expect(typeof focused).toBe('object');
    expect(focused?.props?.testID).toBe('hook-target');

    // Deactivating does not re-request. Pending retries from the active
    // window keep running while the node stays mounted — cancellation is
    // ref-detachment-based (unmount), and repeat-focusing a live node is
    // harmless by design.
    await rerender(<HookTarget active={false} />);
    runNextRetry(pendingTimers, sendSpy);
    runNextRetry(pendingTimers, sendSpy);
    expect(sendSpy).toHaveBeenCalledTimes(3);
  });
});

function runNextRetry(pendingTimers: TimerCallback[], sendSpy: ReturnType<typeof jest.spyOn>): void {
  const callback = pendingTimers.shift();
  expect(callback).toBeDefined();
  callback?.();
  // Keep the parameter in the helper's contract explicit: the callback itself
  // owns the platform call; this assertion catches accidental empty retries.
  expect(sendSpy).toHaveBeenCalled();
}
