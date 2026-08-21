/**
 * Announce + LiveRegion rendered contract (campaign 011 W14).
 *
 * Pins the platform split that prevents double-speak:
 * - `LiveRegion` on Android renders the live-region NODE and must NOT fire
 *   the imperative announcement (the node's text change speaks).
 * - On iOS/web it renders nothing and relies solely on the imperative call.
 * - `announce()` is a guarded pass-through (empty messages are dropped).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { announce, LiveRegion } from '@/components/a11y/announcements';

const osDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOs(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('announce', () => {
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    announceSpy.mockRestore();
  });

  it('posts the message to the platform announcer', () => {
    announce('Round passed');
    expect(announceSpy).toHaveBeenCalledWith('Round passed');
  });

  it('drops empty and whitespace-only messages', () => {
    announce('');
    announce('   ');
    expect(announceSpy).not.toHaveBeenCalled();
  });
});

describe('LiveRegion', () => {
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    announceSpy.mockRestore();
    if (osDescriptor) {
      Object.defineProperty(Platform, 'OS', osDescriptor);
    }
  });

  describe('iOS/web path', () => {
    beforeEach(() => {
      setPlatformOs('ios');
    });

    it('renders no node and announces imperatively once per message change', async () => {
      const { rerender } = await render(<LiveRegion message="Score 750" testID="live" />);
      expect(screen.queryByTestId('live')).toBeNull();
      expect(announceSpy).toHaveBeenCalledTimes(1);
      expect(announceSpy).toHaveBeenLastCalledWith('Score 750');

      await rerender(<LiveRegion message="Score 900" testID="live" />);
      expect(announceSpy).toHaveBeenCalledTimes(2);
      expect(announceSpy).toHaveBeenLastCalledWith('Score 900');

      // Unchanged message does not re-announce.
      await rerender(<LiveRegion message="Score 900" testID="live" />);
      expect(announceSpy).toHaveBeenCalledTimes(2);
    });

    it('never announces an empty initial message', async () => {
      await render(<LiveRegion message="" testID="live" />);
      expect(announceSpy).not.toHaveBeenCalled();
    });
  });

  describe('Android path', () => {
    beforeEach(() => {
      setPlatformOs('android');
    });

    it('renders a polite live-region node WITHOUT imperative announcements (no double-speak)', async () => {
      const { rerender } = await render(<LiveRegion message="Paused. Challenge hidden." testID="live" />);
      const node = screen.getByTestId('live');
      expect(node.props.accessibilityLiveRegion).toBe('polite');
      expect(node.props.pointerEvents).toBe('none');

      await rerender(<LiveRegion message="Resumed." testID="live" />);
      // The text change inside the region triggers the platform speech; the
      // imperative channel must stay silent or TalkBack would speak twice.
      expect(announceSpy).not.toHaveBeenCalled();
    });

    it('exposes assertive priority only through the node attribute', async () => {
      const { rerender } = await render(
        <LiveRegion message="Session complete" assertive testID="live" />,
      );
      expect(screen.getByTestId('live').props.accessibilityLiveRegion).toBe('assertive');

      // Downgrading to polite updates the node without any imperative call.
      await rerender(<LiveRegion message="Session complete" testID="live" />);
      expect(screen.getByTestId('live').props.accessibilityLiveRegion).toBe('polite');
      expect(announceSpy).not.toHaveBeenCalled();
    });
  });
});
