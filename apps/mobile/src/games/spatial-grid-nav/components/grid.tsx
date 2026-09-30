/**
 * Grid rendering for the Spatial Grid Navigator game.
 *
 * `GridBoard` draws an N×N board: the start cell shows a direction arrow, and
 * any `markers` (e.g. the correct final cell, or the player's wrong pick) are
 * tinted. `OptionCell` renders one answer option as a mini board whose single
 * highlighted cell is the candidate final cell. `CommandList` renders the
 * command sequence as readable text. Plain Views/Text only (no Skia).
 */
import { Pressable, StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";
import type { Cell, Command, Dir } from "../types";
import { MIN_TOUCH_TARGET } from '@/components/a11y';

/** Unicode arrow glyphs per facing direction. */
export const DIR_ARROW: Readonly<Record<Dir, string>> = {
  N: "↑",
  E: "→",
  S: "↓",
  W: "←",
};

/** Human-readable label for a command. */
export function commandLabel(command: Command): string {
  switch (command.type) {
    case "forward":
      return "Move forward";
    case "back":
      return "Move back";
    case "left":
      return "Turn left";
    case "right":
      return "Turn right";
  }
}

export interface GridMarker {
  /** Tile fill. Verdict markers use the `*Soft` family (see screen.tsx). */
  readonly cell: Cell;
  readonly color: string;
  /**
   * Tile border. Defaults to the decorative hairline; verdict markers pass
   * the verdict-family base so the boundary carries the verdict too.
   */
  readonly border?: string;
  /**
   * Centered ✓/✕ glyph. Decorative for assistive tech (the verdict wording
   * lives in the option labels and the result headline); hidden from the
   * accessibility tree where rendered.
   */
  readonly glyph?: string;
  /** Glyph colour. */
  readonly glyphColor?: string;
}

export interface GridBoardProps {
  readonly side: number;
  readonly start?: Cell | null;
  readonly startDir?: Dir;
  readonly markers?: readonly GridMarker[];
  readonly testID: string;
  /**
   * Accessibility label for the board. When omitted, NO label prop is set at
   * all — an unlabeled plain View does not become an Android a11y grouping
   * node. This matters: a labeled container nested inside an accessibility
   * button (e.g. decorative option boards) collapses the Android a11y tree
   * on Fabric — campaign 011 device finding (PauseOverlay subtree vanished
   * from uiautomator/TalkBack while such options were mounted).
   */
  readonly accessibilityLabel?: string;
}

/** The N×N board with the start marker and any highlight markers. */
export function GridBoard({
  side,
  start,
  startDir,
  markers = [],
  testID,
  accessibilityLabel,
}: GridBoardProps) {
  const theme = useTheme();
  const markerAt = (row: number, col: number): GridMarker | undefined =>
    markers.find((m) => m.cell.row === row && m.cell.col === col);

  return (
    <View
      style={styles.grid}
      testID={testID}
      {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
    >
      {Array.from({ length: side * side }, (_, index) => {
        const row = Math.floor(index / side);
        const col = index % side;
        const isStart =
          start !== null &&
          start !== undefined &&
          start.row === row &&
          start.col === col;
        const marker = markerAt(row, col);
        const isMarked = marker !== undefined;
        const cellColor = isMarked ? marker!.color : theme.surface;
        const hasVerdictBorder = isMarked && marker!.border !== undefined;
        return (
          <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
            <View
              testID={testId(GAME_ID, "cell", String(index))}
              style={[
                styles.tile,
                {
                  backgroundColor: cellColor,
                  borderColor: hasVerdictBorder ? marker!.border! : theme.border,
                  borderWidth: hasVerdictBorder ? 3 : 1.5,
                },
              ]}
            >
              {isStart && startDir ? (
                <ThemedText
                  type="headline"
                  testID={testId(GAME_ID, "start-marker")}
                >
                  {DIR_ARROW[startDir]}
                </ThemedText>
              ) : null}
              {!isStart && isMarked && marker!.glyph ? (
                <View importantForAccessibility="no-hide-descendants">
                  <ThemedText
                    type="headline"
                    style={
                      marker!.glyphColor !== undefined
                        ? { color: marker!.glyphColor }
                        : undefined
                    }
                    allowFontScaling={false}
                  >
                    {marker!.glyph}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export interface CommandListProps {
  readonly commands: readonly Command[];
  readonly testID: string;
}

/** Readable list of the command sequence. */
export function CommandList({ commands, testID }: CommandListProps) {
  return (
    <View style={styles.commandList} testID={testID}>
      {commands.map((command, i) => (
        <ThemedText
          key={i}
          type="bodyLarge"
          testID={testId(GAME_ID, "command", String(i))}
        >
          {`${i + 1}. ${commandLabel(command)}`}
        </ThemedText>
      ))}
    </View>
  );
}

export interface OptionCellProps {
  readonly index: number;
  readonly side: number;
  readonly cell: Cell;
  readonly selected: boolean;
  readonly correct: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}

/** One answer option: a mini board highlighting the candidate final cell. */
export function OptionCell({
  index,
  side,
  cell,
  selected,
  correct,
  disabled = false,
  onPress,
}: OptionCellProps) {
  const theme = useTheme();

  // Verdicts change fill AND border AND glyph, never colour alone
  // (PATTERNS-PLAY 6, spatial-transform-match canary): the correct route gets
  // a success-soft fill plus a ✓ badge, the wrong step a danger-soft fill
  // plus a ✕ badge. Badges are decorative for assistive tech; the button's
  // accessibility label carries the verdict in words. Both states stay
  // visible together on the trial result. The inner mini board keeps the
  // game's own accent candidate marker (mechanic, not verdict).
  const isWrongPick = selected && !correct;
  const verdictGlyph = correct ? "✓" : isWrongPick ? "✕" : null;
  const backgroundColor = correct
    ? theme.successSoft
    : isWrongPick
      ? theme.dangerSoft
      : undefined;
  const borderColor = correct
    ? theme.success
    : isWrongPick
      ? theme.danger
      : theme.border;
  const accessibilityLabel = correct
    ? `Option ${index + 1}, cell row ${cell.row + 1} column ${cell.col + 1}, correct`
    : isWrongPick
      ? `Option ${index + 1}, cell row ${cell.row + 1} column ${cell.col + 1}, wrong pick`
      : `Option ${index + 1}, cell row ${cell.row + 1} column ${cell.col + 1}`;

  const markers: GridMarker[] = [{ cell, color: theme.accent }];

  return (
    <Pressable
      testID={testId(GAME_ID, "option", String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionContainer,
        {
          backgroundColor,
          borderColor,
          borderWidth: verdictGlyph !== null ? 3 : 2,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}
    >
      {/* The mini board is purely decorative: the outer button already
       * announces "Option N, cell row X column Y", so the inner board gets
       * NO accessibilityLabel (an unlabeled plain View creates no Android
       * a11y grouping node). Campaign 011 device finding: deep view nests
       * inside accessibility buttons corrupt the Android a11y tree on
       * Fabric — see the paused-gating note in screen.tsx. */}
      <GridBoard
        side={side}
        markers={markers}
        testID={testId(GAME_ID, "option-grid", String(index))}
      />
      {verdictGlyph !== null ? (
        <View
          testID={testId(GAME_ID, "option-verdict", String(index))}
          style={[
            styles.verdict,
            { backgroundColor: correct ? theme.success : theme.danger },
          ]}
          importantForAccessibility="no-hide-descendants"
        >
          <ThemedText
            type="label"
            style={{ color: correct ? theme.successOn : theme.dangerOn }}
            allowFontScaling={false}
          >
            {verdictGlyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "stretch",
  },
  cell: {
    padding: Spacing.one,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  commandList: {
    gap: Spacing.one,
  },
  optionContainer: {
    borderWidth: 2,
    borderRadius: 8,
    padding: Spacing.one,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  verdict: {
    position: "absolute",
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
