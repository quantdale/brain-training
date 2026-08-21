/**
 * ResultRow / StatRow accessibility — shared primitive contract (task 08).
 *
 * These are pure presentational rows with no theme/interaction dependency, so
 * they live in their own file to stay isolated from the interactive
 * QaPanelShell test (which mounts a theme context and drives state) — RNTL's
 * global `screen` singleton can otherwise leak a preceding tree into a
 * subsequent query.
 *
 * Guards: label and value render as separate, individually readable nodes, and
 * the value exposes an optional testID for assertions.
 */
import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { ResultRow, StatRow } from "@/components/game-ui";

describe("ResultRow / StatRow accessibility", () => {
   it("renders label and value as separate, readable nodes", async () => {
      const { getByText } = await render(
         <ResultRow label="Accuracy" value="100%" />,
      );
      expect(getByText("Accuracy")).toBeTruthy();
      expect(getByText("100%")).toBeTruthy();
   });

   it("exposes an optional value testID for assertions", async () => {
      const { getByTestId } = await render(
         <StatRow label="Score" value="750" testID="r-score" />,
      );
      const value = getByTestId("r-score");
      expect(value.props.children).toBe("750");
   });
});
