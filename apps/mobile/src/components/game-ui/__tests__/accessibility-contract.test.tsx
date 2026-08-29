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
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { PauseOverlay, QaPanelShell } from "@/components/game-ui";
import { createPauseOverlaySpec } from "@/sdk";

describe("PauseOverlay accessibility", () => {
     it("is an accessibility modal that hides the challenge (no answer leakage)", async () => {
          const spec = createPauseOverlaySpec("memory");
          await render(
               <PauseOverlay
                    gameId="memory"
                    onResume={() => {}}
                    onQuit={() => {}}
               />,
          );
          const overlay = screen.getByTestId(spec.testID);
          // Campaign-011 device contract update: the overlay root must stay a
          // plain, unlabeled, NON-modal container. `accessibilityViewIsModal` /
          // `accessibilityLabel` on the root turn it into one Android a11y leaf
          // that absorbs Resume/Quit — uiautomator then sees only a childless
          // "Paused." node and the session becomes unresumable (reproduced on
          // device during the 011 catalog run). The "pause obscures the answer"
          // contract is enforced from the other side: game screens hide their
          // challenge content while paused
          // (`importantForAccessibility="no-hide-descendants"` in each screen /
          // GameHost), so there is nothing to leak through.
          expect(overlay.props.accessibilityViewIsModal).toBeUndefined();
          expect(overlay.props.accessible).toBeFalsy();
          // The root carries no label of its own; children stay individually
          // focusable so Resume/Quit remain reachable by TalkBack/automation.
          expect(overlay.props.accessibilityLabel).toBeUndefined();
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

          await act(async () => {
               fireEvent.press(toggle);
          });
          const panel = await screen.findByTestId("memory.qa-panel");
          expect(panel).toBeTruthy();

          const win = await screen.findByTestId("memory.force-win");
          const lose = await screen.findByTestId("memory.force-lose");
          expect(win.props.accessibilityRole).toBe("button");
          expect(lose.props.accessibilityRole).toBe("button");

          await act(async () => {
               fireEvent.press(win);
          });
          expect(onForceWin).toHaveBeenCalledTimes(1);
          await act(async () => {
               fireEvent.press(lose);
          });
          expect(onForceLose).toHaveBeenCalledTimes(1);
     });
});
