/**
 * Grid rendering for the Spatial Grid Navigator game.
 *
 * `GridBoard` draws an N×N board: the start cell shows a direction arrow, and
 * any `markers` (e.g. the correct final cell, or the player's wrong pick) are
 * tinted. `OptionCell` renders one answer option as a mini board whose single
 * highlighted cell is the candidate final cell. `CommandList` renders the
 * command sequence as readable text. Plain Views/Text only (no Skia).
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { Cell, Command, Dir } from '../types';

/** Unicode arrow glyphs per facing direction. */
export const DIR_ARROW: Readonly<Record<Dir, string>> = {
  N: '↑',
  E: '→',
  S: '↓',
  W: '←',
};

/** Human-readable label for a command. */
export function commandLabel(command: Command): string {
  switch (command.type) {
    case 'forward':
      return 'Move forward';
    case 'back':
      return 'Move back';
    case 'left':
      return 'Turn left';
    case 'right':
      return 'Turn right';
  }
}

export interface GridMarker {
  readonly cell: Cell;
  readonly color: string;
  readonly glyph?: string;
}

export interface GridBoardProps {
  readonly side: number;
  readonly start?: Cell | null;
  readonly startDir?: Dir;
  readonly markers?: readonly GridMarker[];
  readonly testID: string;
  readonly accessibilityLabel?: string;
}

/** The N×N board with the start marker and any highlight markers. */
export function GridBoard({
  side,
  start,
  startDir,
  markers = [],
  testID,
  accessibilityLabel = 'Grid',
}: GridBoardProps) {
  const theme = useTheme();
  const markerAt = (row: number, col: number): GridMarker | undefined =>
    markers.find((m) => m.cell.row === row && m.cell.col === col);

  return (
    <View
      style={styles.grid}
      testID={testID}
      accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: side * side }, (_, index) => {
        const row = Math.floor(index / side);
        const col = index % side;
        const isStart = start !== null && start !== undefined && start.row === row && start.col === col;
        const marker = markerAt(row, col);
        const isMarked = marker !== undefined;
        const cellColor = isMarked ? marker!.color : theme.surface;
        return (
          <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
            <View
              testID={testId(GAME_ID, 'cell', String(index))}
              style={[
                styles.tile,
                {
                  backgroundColor: cellColor,
                  borderColor: theme.border,
                },
              ]}>
              {isStart && startDir ? (
                <ThemedText type="headline" testID={testId(GAME_ID, 'start-marker')}>
                  {DIR_ARROW[startDir]}
                </ThemedText>
              ) : null}
              {!isStart && isMarked && marker!.glyph ? (
                <ThemedText type="headline">{marker!.glyph}</ThemedText>
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
          testID={testId(GAME_ID, 'command', String(i))}>
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

  let borderColor: string = theme.border;
  if (correct) {
    borderColor = theme.success;
  } else if (selected && !correct) {
    borderColor = theme.danger;
  }

  const markers: GridMarker[] = [{ cell, color: theme.accent }];

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Option ${index + 1}, cell row ${cell.row + 1} column ${cell.col + 1}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionContainer,
        { borderColor, opacity: pressed || disabled ? 0.8 : 1 },
      ]}>
      <GridBoard
        side={side}
        markers={markers}
        testID={testId(GAME_ID, 'option-grid', String(index))}
        accessibilityLabel={`Option ${index + 1} board`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  cell: {
    padding: Spacing.one,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandList: {
    gap: Spacing.one,
  },
  optionContainer: {
    borderWidth: 2,
    borderRadius: 8,
    padding: Spacing.one,
  },
});
