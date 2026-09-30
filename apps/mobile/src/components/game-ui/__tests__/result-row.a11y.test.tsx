/**
 * StatRow accessibility — shared primitive contract (task 08).
 *
 * These are pure presentational rows with no theme/interaction dependency, so
 * they live in their own file to stay isolated from the interactive
 * QaPanelShell test (which mounts a theme context and drives state) — RNTL's
 * global `screen` singleton can otherwise leak a preceding tree into a
 * subsequent query.
 *
 * Guards (065): each row is ONE accessible statement (`label: value`) so a
 * screen reader does not read the two visual columns as unrelated facts. The
 * two-column layout and the optional value testID survive unchanged.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { StatRow } from '@/components/game-ui';

describe("StatRow accessibility", () => {
   it("presents label and value as one accessible statement", async () => {
      await render(<StatRow label="Accuracy" value="100%" />);

      const row = screen.getByLabelText("Accuracy: 100%");
      expect(row.props.accessible).toBe(true);
      // Visual two-column layout is unchanged: both cells still render.
      expect(screen.getByText("Accuracy")).toBeTruthy();
      expect(screen.getByText("100%")).toBeTruthy();
   });

   it("combines StatRow into one statement and keeps the value testID", async () => {
      await render(<StatRow label="Score" value="750" testID="r-score" />);

      const row = screen.getByLabelText("Score: 750");
      expect(row.props.accessible).toBe(true);
      expect(screen.getByTestId("r-score").props.children).toBe("750");
   });
});
