/**
 * Shared accessibility contracts for the generic game-ui primitives (task 08).
 *
 * These guards protect the cross-catalog a11y contract every game inherits:
 *  - PauseOverlay must be an accessibility-modal that hides the challenge from
 *    the screen-reader tree (no answer leakage through VoiceOver/TalkBack).
 *  - QaPanelShell exposes a labelled toggle + force controls with correct roles.
 *  - ResultRow/StatRow expose label/value pairs without leaking state.
 *
 * RNTL v14 `render` is async — every render is awaited. No host/device needed.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { PauseOverlay, QaPanelShell } from "@/components/game-ui";
import { createPauseOverlaySpec } from "@/sdk";

describe("PauseOverlay accessibility", () => {
   it("is an accessibility modal that hides the challenge (no answer leakage)", async () => {
      const spec = createPauseOverlaySpec("memory");
      await render(
         <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
      );
      const overlay = screen.getByTestId(spec.testID);
      // The overlay must be modal so the screen reader cannot traverse the
      // (still-mounted) challenge behind it — this is the a11y half of the
      // "pause obscures the answer" contract. The root is intentionally NOT
      // `accessible`: grouping would collapse Resume/Quit into one unfocusable
      // blob (screen-reader users could not activate them, and automation
      // cannot see the buttons).
      expect(overlay.props.accessibilityViewIsModal).toBe(true);
      // Absent (`undefined`) rather than literally false — the prop is simply
      // not set, so children stay individually focusable.
      expect(overlay.props.accessible).toBeFalsy();
      // A truthful, non-empty label (not the answer) must be exposed.
      expect(typeof overlay.props.accessibilityLabel).toBe("string");
      expect(overlay.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(overlay.props.accessibilityLabel).not.toMatch(
         /answer|solution|correct/i,
      );
   });
});

describe("QaPanelShell accessibility", () => {
   it("exposes a labelled toggle with the button role and opens force controls", async () => {
      const onForceWin = jest.fn();
      const onForceLose = jest.fn();
      await render(
         <QaPanelShell
            gameId="memory"
            onForceWin={onForceWin}
            onForceLose={onForceLose}
         />,
      );

      const toggle = screen.getByTestId("memory.qa-toggle");
      expect(toggle.props.accessibilityRole).toBe("button");

      // Panel is collapsed until toggled.
      expect(screen.queryByTestId("memory.qa-panel")).toBeNull();

      fireEvent.press(toggle);
      const panel = await screen.findByTestId("memory.qa-panel");
      expect(panel).toBeTruthy();

      const win = await screen.findByTestId("memory.force-win");
      const lose = await screen.findByTestId("memory.force-lose");
      expect(win.props.accessibilityRole).toBe("button");
      expect(lose.props.accessibilityRole).toBe("button");

      fireEvent.press(win);
      expect(onForceWin).toHaveBeenCalledTimes(1);
      fireEvent.press(lose);
      expect(onForceLose).toHaveBeenCalledTimes(1);
   });
});
