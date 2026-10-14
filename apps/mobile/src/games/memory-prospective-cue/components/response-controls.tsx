/**
 * ResponseControls — the two stream-phase actions: GO (ongoing task for every
 * non-signal item) and SIGNAL (the prospective response for held intentions).
 *
 * Accessibility: both are labeled buttons; neither reveals correctness.
 * The screen checks measured exposure at press time, so delayed timer delivery
 * cannot reopen an expired item. Rendered cue stamps and native payload identity
 * keep stale/duplicate presses from leaking into the next unseen item.
 */
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { testId } from "@/sdk";
import { Spacing } from "@/constants/theme";

import { GameButton } from "./button";
import { GAME_ID } from "../types";

export interface ResponseControlsProps {
  disabled?: boolean;
  /** Handler owns the rendered item; native identity distinguishes redelivery. */
  onRespond: (kind: "go" | "signal", event?: GestureResponderEvent) => void;
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
        onPress={(event?: GestureResponderEvent) => onRespond("go", event)}
      />
      <GameButton
        testID={testId(GAME_ID, "signal")}
        label="SIGNAL!"
        disabled={disabled}
        hint="One of your memorized signals appeared — respond Signal."
        onPress={(event?: GestureResponderEvent) => onRespond("signal", event)}
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
