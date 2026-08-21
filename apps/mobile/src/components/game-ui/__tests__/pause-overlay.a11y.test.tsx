/**
 * PauseOverlay rendered accessibility integration (campaign 011 W14).
 *
 * Reproduces the campaign-009 spatial-grid-nav "Resume/Quit unreachable"
 * defect at the render level and pins its root-cause fix: on open, the
 * screen-reader cursor request must target the Resume button's mounted host
 * instance through `AccessibilityInfo.sendAccessibilityEvent`. The legacy
 * numeric-tag API silently no-ops on Fabric/Android, which is exactly why
 * TalkBack users landed behind the overlay with no reachable controls.
 *
 * Also pins the announcement platform split (no double-speak) and the
 * 44pt touch-target / individual-focusability contract from campaign 009.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { PauseOverlay } from '@/components/game-ui/pause-overlay';
import { createPauseOverlaySpec, testId } from '@/sdk';

const osDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOs(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function resolvedStyle(style: unknown): unknown[] {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return Array.isArray(resolved) ? resolved.flat() : [resolved];
}

describe('PauseOverlay', () => {
  let sendSpy: ReturnType<typeof jest.spyOn>;
  let legacyFocusSpy: ReturnType<typeof jest.spyOn>;
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    sendSpy = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => undefined as unknown as void);
    legacyFocusSpy = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => undefined as unknown as void);
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    sendSpy.mockRestore();
    legacyFocusSpy.mockRestore();
    announceSpy.mockRestore();
    if (osDescriptor) {
      Object.defineProperty(Platform, 'OS', osDescriptor);
    }
  });

  it('parks the screen-reader cursor ON the Resume button via the renderer-routed focus event', async () => {
    await render(<PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    // The focused handle is the mounted host instance of the Resume pressable.
    const focused = sendSpy.mock.calls[0][0] as { props?: { testID?: string } } | null;
    expect(focused).toBeTruthy();
    expect(typeof focused).toBe('object');
    expect(focused?.props?.testID).toBe(testId('memory', 'resume'));
    expect(sendSpy.mock.calls[0][1]).toBe('focus');

    // The legacy numeric-tag call is the silent-failure path that stranded
    // TalkBack users behind the overlay; it must stay dead.
    expect(legacyFocusSpy).not.toHaveBeenCalled();
  });

  it('announces the paused state imperatively on iOS only (root live region owns Android)', async () => {
    await render(<PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />);
    // jest-expo default platform is iOS: imperative announcement fires once.
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith(createPauseOverlaySpec('memory').accessibilityLabel);

    announceSpy.mockClear();
    setPlatformOs('android');
    await render(<PauseOverlay gameId="grid" onResume={() => {}} onQuit={() => {}} />);
    // Android double-speak guard: the root node's polite live region speaks;
    // the imperative channel must stay silent.
    expect(announceSpy).not.toHaveBeenCalled();
  });

  it('exposes a polite live region on the root for the paused-state announcement', async () => {
    await render(<PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />);
    const overlay = screen.getByTestId(createPauseOverlaySpec('memory').testID);
    expect(overlay.props.accessibilityLiveRegion).toBe('polite');
  });

  it('keeps Resume and Quit individually focusable (never an accessible group)', async () => {
    await render(<PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />);
    const overlay = screen.getByTestId(createPauseOverlaySpec('memory').testID);

    // Campaign-009 contract: grouping the root would collapse both buttons
    // into one unfocusable blob.
    expect(overlay.props.accessible).toBeFalsy();

    for (const element of ['resume', 'quit'] as const) {
      const button = screen.getByTestId(testId('memory', element));
      expect(button.props.accessibilityRole).toBe('button');
      const flat = resolvedStyle(button.props.style);
      expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
    }
  });
});
