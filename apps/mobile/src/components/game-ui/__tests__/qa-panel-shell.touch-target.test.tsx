/**
 * QaPanelShell touch-target contract (campaign 011 W14).
 *
 * Lives in its own file for the same reason `result-row.a11y.test.tsx` does:
 * the interactive QaPanelShell test above (in accessibility-contract) leaves
 * the global RNTL screen singleton holding an open panel, and a subsequent
 * query against a fresh tree mis-resolves. Dev-only controls still honor the
 * shell-wide 44pt minimum (WCAG 2.5.5).
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { QaPanelShell } from "@/components/game-ui";

describe("QaPanelShell touch target", () => {
   it("keeps the dev-only toggle at the shared 44pt minimum", async () => {
      await render(
         <QaPanelShell gameId="memory" onForceWin={() => {}} onForceLose={() => {}} />,
      );
      const toggle = screen.getByTestId("memory.qa-toggle");
      const style = toggle.props.style;
      const flat = Array.isArray(style) ? style.flat() : [style];
      expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
   });
});
