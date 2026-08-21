/**
 * ResponseControls — the two stream-phase actions: GO (ongoing task for every
 * non-signal item) and SIGNAL (the prospective response for held intentions).
 *
 * Accessibility: both are labeled buttons; neither reveals correctness.
 * Buttons stay enabled while the window is open — a late press still lands
 * within the same item if it beats the timeout dispatch.
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { Spacing } from "@/constants/theme";

import { GameButton } from "./button";
import { GAME_ID } from "../types";

export interface ResponseControlsProps {
  disabled?: boolean;
  /** Stable handler supplied by the screen (avoids per-render closures). */
  onRespond: (kind: "go" | "signal") => void;
}

export function ResponseControls({ disabled = false, onRespond }: ResponseControlsProps) {
  return (
    <View style={styles.row}>
      <GameButton
        testID={testId(GAME_ID, "go")}
        label="GO"
        variant="secondary"
        disabled={disabled}
        hint="Normal symbol — respond Go."
        onPress={() => onRespond("go")}
      />
      <GameButton
        testID={testId(GAME_ID, "signal")}
        label="SIGNAL!"
        disabled={disabled}
        hint="One of your memorized signals appeared — respond Signal."
        onPress={() => onRespond("signal")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    justifyContent: "center",
  },
});
