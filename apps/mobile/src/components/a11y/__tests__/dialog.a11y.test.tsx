/**
 * A11yDialog rendered accessibility contract (campaign 011 W14).
 *
 * Guards the modal semantics and the announcement lifecycle:
 * - exactly ONE title announcement per open — callers routinely pass fresh
 *   inline `onRequestClose` closures every render, and pre-campaign-011 the
 *   announcement rode that identity in the effect deps, so any parent
 *   re-render while the dialog was open re-announced the title (SR spam on
 *   ticking game screens).
 * - Android hardware-back dismissal subscribes only while open+dismissable.
 * - Scrim tap dismisses only when a close handler exists.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { AccessibilityInfo, BackHandler } from 'react-native';

import { A11yDialog } from '@/components/a11y/dialog';

function resolvedStyle(style: unknown): unknown[] {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return Array.isArray(resolved) ? resolved.flat() : [resolved];
}

describe('A11yDialog', () => {
  let announceSpy: ReturnType<typeof jest.spyOn>;
  let backAddSpy: ReturnType<typeof jest.spyOn>;
  let subscriptions: Array<{ remove: jest.Mock }>;

  beforeEach(() => {
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
    subscriptions = [];
    backAddSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((eventName: string, handler: () => boolean) => {
      void eventName;
      void handler;
      const subscription = { remove: jest.fn() };
      subscriptions.push(subscription);
      return subscription as unknown as ReturnType<typeof BackHandler.addEventListener>;
    }) as typeof BackHandler.addEventListener);
  });

  afterEach(() => {
    announceSpy.mockRestore();
    backAddSpy.mockRestore();
  });

  it('exposes dialog semantics so content behind leaves traversal', async () => {
    await render(
      <A11yDialog visible title="Paused" onRequestClose={() => {}} testID="dlg">
        <></>
      </A11yDialog>,
    );
    const card = screen.getByTestId('dlg');
    expect(card.props.role).toBe('dialog');
    expect(card.props['aria-label']).toBe('Paused');
    expect(card.props.accessibilityViewIsModal).toBe(true);
    expect(card.props.importantForAccessibility).toBe('yes');
  });

  it('announces the title exactly once per open', async () => {
    await render(<A11yDialog visible title="Paused" onRequestClose={() => {}} />);
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith('Paused');
  });

  it('does not re-announce when the parent re-renders with fresh inline closures', async () => {
    // Regression pin for the campaign-011 fix: each rerender supplies a new
    // `onRequestClose` identity (as real game screens do on every state tick).
    const { rerender } = await render(
      <A11yDialog visible title="Paused" onRequestClose={() => {}} />,
    );
    await rerender(<A11yDialog visible title="Paused" onRequestClose={() => {}} />);
    await rerender(<A11yDialog visible title="Paused" onRequestClose={() => {}} />);
    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it('skips the announcement when announceOnShow is false', async () => {
    await render(<A11yDialog visible title="Paused" onRequestClose={() => {}} announceOnShow={false} />);
    expect(announceSpy).not.toHaveBeenCalled();
  });

  it('subscribes to hardware back while open and unsubscribes on close', async () => {
    const { rerender } = await render(
      <A11yDialog visible={true} title="Paused" onRequestClose={() => {}} />,
    );
    expect(backAddSpy).toHaveBeenCalledTimes(1);

    await rerender(<A11yDialog visible={false} title="Paused" onRequestClose={() => {}} />);
    expect(backAddSpy).toHaveBeenCalledTimes(1); // no resubscribe while closed
    expect(subscriptions[0].remove).toHaveBeenCalledTimes(1);
  });

  it('never subscribes to hardware back when not dismissable', async () => {
    await render(<A11yDialog visible={true} title="Locked" />);
    expect(backAddSpy).not.toHaveBeenCalled();
  });

  it('invokes onRequestClose from the hardware back handler', async () => {
    const onClose = jest.fn();
    await render(<A11yDialog visible={true} title="Paused" onRequestClose={onClose} />);
    const handler = backAddSpy.mock.calls[0][1] as () => boolean;
    expect(handler()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses via scrim tap when dismissable', async () => {
    const onClose = jest.fn();
    await render(<A11yDialog visible title="Paused" onRequestClose={onClose} testID="dlg" />);
    // RNTL v14's default testID matcher skips childless host leaves, so the
    // labelled-but-empty scrim Pressable is reached structurally: it is the
    // first child of the `-scrim` layout container.
    const scrim = screen.getByTestId('dlg-scrim').children[0] as TestInstance;
    expect(scrim.props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses via the Close button', async () => {
    const onClose = jest.fn();
    await render(<A11yDialog visible title="Paused" onRequestClose={onClose} testID="dlg" />);
    fireEvent.press(screen.getByTestId('dlg-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders an inert scrim and no Close button when not dismissable', async () => {
    await render(<A11yDialog visible title="Locked" testID="dlg" />);
    // Same structural seam as the dismissable-scrim test above.
    const scrim = screen.getByTestId('dlg-scrim').children[0] as TestInstance;
    expect(scrim.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(scrim);
    expect(screen.queryByTestId('dlg-close')).toBeNull();
  });

  it('ships a labelled Close button meeting the 44pt touch-target contract', async () => {
    await render(<A11yDialog visible title="Paused" onRequestClose={() => {}} testID="dlg" />);
    const close = screen.getByTestId('dlg-close');
    expect(close.props.accessibilityRole).toBe('button');
    expect(close.props.accessibilityLabel).toBe('Close dialog');
    const flat = resolvedStyle(close.props.style);
    expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
  });

  it('renders nothing when visible is false', async () => {
    await render(
      <A11yDialog visible={false} title="Paused" onRequestClose={() => {}} testID="dlg" />,
    );
    expect(screen.queryByTestId('dlg')).toBeNull();
    expect(screen.queryByTestId('dlg-scrim')).toBeNull();
    expect(announceSpy).not.toHaveBeenCalled();
  });
});
