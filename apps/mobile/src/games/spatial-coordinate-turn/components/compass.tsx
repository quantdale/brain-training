/**
 * Compass / heading rendering for the Spatial Coordinate Turn game.
 *
 * `CompassView` draws a heading as a compass face: a ring with a rotated needle
 * (a plain rotated `View`, no Skia) plus the direction glyph + label.
 * `OptionArrow` / `OptionCoord` render one answer option. Distinct glyphs AND
 * text labels are used (never colour alone) so the options are distinguishable
 * and the accessibility labels never disclose the correct answer.
 *
 * Plain Views/Text only. Static rotations (transform rotate to a fixed angle)
 * are used, not animations — there is nothing to guard behind reduced-motion.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { Command, Coord, Dir } from '../types';

/** Unicode arrow glyph per heading (inherently encodes direction). */
export const DIR_ARROW: Readonly<Record<Dir, string>> = {
  N: '↑',
  NE: '↗',
  E: '→',
  SE: '↘',
  S: '↓',
  SW: '↙',
  W: '←',
  NW: '↖',
};

/** Short text label per heading (also the accessible label stem). */
export const DIR_LABEL: Readonly<Record<Dir, string>> = {
  N: 'N',
  NE: 'NE',
  E: 'E',
  SE: 'SE',
  S: 'S',
  SW: 'SW',
  W: 'W',
  NW: 'NW',
};

/** Heading → clockwise angle in degrees (N = 0, E = 90, …). */
const DIR_ANGLE: Readonly<Record<Dir, number>> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/** Human-readable label for a command. */
export function commandLabel(command: Command): string {
  switch (command.type) {
    case 'left':
      return 'Turn left';
    case 'right':
      return 'Turn right';
    case 'about':
      return 'Turn around';
    case 'forward':
      return `Move forward ${command.steps ?? 1}`;
    case 'back':
      return `Move back ${command.steps ?? 1}`;
  }
}

export interface CompassViewProps {
  readonly heading: Dir;
  readonly testID: string;
  /** Diameter in px (default 96). */
  readonly size?: number;
}

/** A compass face showing a single heading. */
export function CompassView({ heading, testID, size = 96 }: CompassViewProps) {
  const theme = useTheme();
  const angle = DIR_ANGLE[heading];

  return (
    <View
      testID={testID}
      accessibilityLabel={`Heading ${DIR_LABEL[heading]}`}
      style={[
        styles.compass,
        { width: size, height: size, borderRadius: size / 2, borderColor: theme.border },
      ]}>
      <View style={styles.needleWrap} pointerEvents="none">
        <View
          style={[
            styles.needle,
            { height: size * 0.42, backgroundColor: theme.accent, transform: [{ rotate: `${angle}deg` }] },
          ]}
        />
      </View>
      <View style={styles.glyphWrap}>
        <ThemedText type="title" style={{ color: theme.accent }}>
          {DIR_ARROW[heading]}
        </ThemedText>
      </View>
    </View>
  );
}

export interface CommandListProps {
  readonly commands: readonly Command[];
  readonly testID: string;
}

/** Readable vertical list of the command sequence. */
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

export interface OptionArrowProps {
  readonly dir: Dir;
  readonly index: number;
  readonly selected: boolean;
  readonly correct: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}

/** One heading answer option: a circular button with arrow glyph + label. */
export function OptionArrow({ dir, index, selected, correct, disabled = false, onPress }: OptionArrowProps) {
  const theme = useTheme();
  const borderColor = correct ? theme.success : selected && !correct ? theme.danger : theme.border;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Direction ${DIR_LABEL[dir]}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderColor, opacity: pressed || disabled ? 0.8 : 1 },
      ]}>
      <ThemedText type="headline" style={{ color: theme.text }}>
        {DIR_ARROW[dir]}
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
        {DIR_LABEL[dir]}
      </ThemedText>
    </Pressable>
  );
}

export interface OptionCoordProps {
  readonly coord: Coord;
  readonly index: number;
  readonly selected: boolean;
  readonly correct: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}

/** One position answer option: a button with an (x, y) coordinate label. */
export function OptionCoord({ coord, index, selected, correct, disabled = false, onPress }: OptionCoordProps) {
  const theme = useTheme();
  const borderColor = correct ? theme.success : selected && !correct ? theme.danger : theme.border;
  const label = `x ${coord.x}, y ${coord.y}`;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Coordinate ${label}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCoord,
        { borderColor, opacity: pressed || disabled ? 0.8 : 1 },
      ]}>
      <ThemedText type="bodyLarge" style={{ color: theme.text }}>
        {`(${coord.x}, ${coord.y})`}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compass: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  needleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needle: {
    width: 4,
    borderRadius: 2,
  },
  glyphWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandList: {
    gap: Spacing.one,
  },
  // Minimum 44px touch target per platform accessibility guidance.
  option: {
    width: 72,
    height: 72,
    minWidth: 44,
    minHeight: 44,
    borderRadius: Radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  optionCoord: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
