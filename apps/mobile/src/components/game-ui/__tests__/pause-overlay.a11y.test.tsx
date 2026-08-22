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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";

import { PauseOverlay } from "@/components/game-ui/pause-overlay";
import { createPauseOverlaySpec, testId } from "@/sdk";

const osDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");

function setPlatformOs(os: string): void {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

function resolvedStyle(style: unknown): unknown[] {
  const resolved =
    typeof style === "function" ? style({ pressed: false }) : style;
  return Array.isArray(resolved) ? resolved.flat() : [resolved];
}

describe("PauseOverlay", () => {
  let sendSpy: ReturnType<typeof jest.spyOn>;
  let legacyFocusSpy: ReturnType<typeof jest.spyOn>;
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    sendSpy = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => undefined as unknown as void);
    legacyFocusSpy = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined as unknown as void);
    announceSpy = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    sendSpy.mockRestore();
    legacyFocusSpy.mockRestore();
    announceSpy.mockRestore();
    if (osDescriptor) {
      Object.defineProperty(Platform, "OS", osDescriptor);
    }
  });

  it("parks the screen-reader cursor ON the Resume button via the renderer-routed focus event", async () => {
    await render(
      <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    // The focused handle is the mounted host instance of the Resume pressable.
    const focused = sendSpy.mock.calls[0][0] as {
      props?: { testID?: string };
    } | null;
    expect(focused).toBeTruthy();
    expect(typeof focused).toBe("object");
    expect(focused?.props?.testID).toBe(testId("memory", "resume"));
    expect(sendSpy.mock.calls[0][1]).toBe("focus");

    // The legacy numeric-tag call is the silent-failure path that stranded
    // TalkBack users behind the overlay; it must stay dead.
    expect(legacyFocusSpy).not.toHaveBeenCalled();
  });

  it("announces the paused state imperatively on every platform", async () => {
    await render(
      <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
    );
    // jest-expo default platform is iOS: imperative announcement fires once.
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith(
      createPauseOverlaySpec("memory").accessibilityLabel,
    );

    // Campaign-011 update: the root no longer carries a polite live region.
    // A labeled/live-region root collapses the whole overlay subtree into a
    // single Android a11y leaf — Resume/Quit vanished from uiautomator and
    // TalkBack alike (device-reproduced on 3 games in the 011 catalog run).
    // The imperative channel is therefore the ONLY announcement path now,
    // on Android as well.
    announceSpy.mockClear();
    setPlatformOs("android");
    await render(
      <PauseOverlay gameId="grid" onResume={() => {}} onQuit={() => {}} />,
    );
    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the overlay root unlabeled and free of live regions", async () => {
    await render(
      <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
    );
    const overlay = screen.getByTestId(createPauseOverlaySpec("memory").testID);
    // Campaign-011 device contract: a labeled or live-region root turns the
    // overlay into one grouping leaf that absorbs Resume/Quit (childless
    // "Paused." node in uiautomator). The paused state is announced via the
    // imperative channel instead; the root stays a plain container.
    expect(overlay.props.accessibilityLiveRegion).toBeUndefined();
    expect(overlay.props.accessibilityLabel).toBeUndefined();
  });

  it("keeps Resume and Quit individually focusable (never an accessible group)", async () => {
    await render(
      <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
    );
    const overlay = screen.getByTestId(createPauseOverlaySpec("memory").testID);

    // Campaign-009 contract: grouping the root would collapse both buttons
    // into one unfocusable blob.
    expect(overlay.props.accessible).toBeFalsy();

    for (const element of ["resume", "quit"] as const) {
      const button = screen.getByTestId(testId("memory", element));
      expect(button.props.accessibilityRole).toBe("button");
      const flat = resolvedStyle(button.props.style);
      expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
    }
  });
});
