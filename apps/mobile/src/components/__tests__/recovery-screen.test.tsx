/**
 * 058: RecoveryScreen degraded-path contracts — renders with plain RN
 * primitives (no providers) and enforces the 44dp retry floor by style.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { RecoveryScreen } from "@/components/recovery-screen";

describe("RecoveryScreen degraded contracts", () => {
  it("renders without any providers and keeps the retry reachable", async () => {
    await render(
      <RecoveryScreen
        testIDPrefix="degraded-probe"
        title="Storage unavailable"
        message="Training data cannot load."
        steps={["Close the app", "Reopen it"]}
        onRetry={() => {}}
      />,
    );
    const retry = screen.getByTestId("degraded-probe-retry");
    const rawStyle = retry.props.style;
    const resolved =
      typeof rawStyle === "function" ? rawStyle({ pressed: false }) : rawStyle;
    const flat = Array.isArray(resolved)
      ? Object.assign({}, ...resolved)
      : resolved;
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    expect(retry.props.hitSlop).toBeDefined();
  });
});
