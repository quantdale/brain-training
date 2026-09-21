/**
 * Stimulus — renders a Rule Flip card: a colored shape (circle / triangle /
 * square / star) with a number badge. Drawn with plain `react-native`
 * `View`/`Text` primitives (no Skia). Used both for the target and the
 * candidate cards; it becomes pressable when `onPress` is supplied.
 *
 * Visual states mirror the card-sort semantics: `idle`, `correct` (the true
 * match once the round is scored) and `error` (the wrong pick once scored).
 * Verdicts change fill AND border weight AND add a ✓/✕ badge, never colour
 * alone, so a miss never reads as a match when both render side by side.
 *
 * The card always conveys THREE redundant signals — color, shape, AND number
 * — so color is never the sole channel (accessibility + the game's explicit
 * "color is not the only signal" constraint).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { MinTouchTarget } from '@/theme/tokens';
import { useTheme } from '@/hooks/use-theme';

import type { Card, ColorId, ShapeId } from '../types';

/** Stable color palette for the stimulus (hex strings, theme-independent). */
export const STIMULUS_COLORS: Readonly<Record<ColorId, string>> = {
  red: '#e5484d',
  blue: '#3b82f6',
  green: '#30a46c',
  yellow: '#f5d90a',
};

export type StimulusVisualState = 'idle' | 'correct' | 'error';

export interface StimulusProps {
  card: Card;
  /** Composed semantic testID for the pressable (screen composes via `testId`). */
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  state?: StimulusVisualState;
  /** Edge length in px (default 96). */
  size?: number;
}

const STAR_GLYPH = '★';

function ShapeGlyph({
  shape,
  color,
  size,
}: {
  shape: ShapeId;
  color: string;
  size: number;
}) {
  if (shape === 'circle') {
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    );
  }
  if (shape === 'square') {
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            borderRadius: Radii.medium,
            backgroundColor: color,
          },
        ]}
      />
    );
  }
  if (shape === 'triangle') {
    // Up-pointing triangle via the CSS border trick.
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'flex-end',
          },
        ]}
      >
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
          }}
        />
      </View>
    );
  }
  // star: a bold glyph in the shape's color.
  return (
    <View
      style={[
        styles.shape,
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <ThemedText style={[{ color, fontSize: size * 0.72, lineHeight: size * 0.72 }]}>
        {STAR_GLYPH}
      </ThemedText>
    </View>
  );
}

export const Stimulus = memo(function Stimulus({
  card,
  testID,
  onPress,
  disabled = false,
  state = 'idle',
  size = 96,
}: StimulusProps) {
  const theme = useTheme();
  const color = STIMULUS_COLORS[card.color];

  // Verdicts change fill AND border weight AND add a glyph badge, never
  // colour alone (PATTERNS-PLAY 6): the picked-wrong card and the correct
  // card render side by side in the round-result grid. The badge is
  // decorative for assistive tech — the label below carries the verdict in
  // words ("Correct: …" / "Wrong pick: …").
  const borderColor =
    state === 'correct'
      ? theme.success
      : state === 'error'
        ? theme.danger
        : theme.border;
  const backgroundColor =
    state === 'correct'
      ? theme.successSoft
      : state === 'error'
        ? theme.dangerSoft
        : 'transparent';
  const verdictGlyph = state === 'correct' ? '✓' : state === 'error' ? '✕' : null;
  const verdictFill =
    state === 'correct' ? theme.success : state === 'error' ? theme.danger : null;
  const verdictOn =
    state === 'correct' ? theme.successOn : state === 'error' ? theme.dangerOn : null;
  const a11yLabel =
    state === 'correct'
      ? `Correct: ${card.color} ${card.shape} ${card.number}`
      : state === 'error'
        ? `Wrong pick: ${card.color} ${card.shape} ${card.number}`
        : `${card.color} ${card.shape} ${card.number}`;

  const content = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderColor,
          backgroundColor,
          borderWidth: verdictGlyph !== null ? 3 : 2,
        },
      ]}
    >
      <ShapeGlyph shape={card.shape} color={color} size={size * 0.66} />
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText type="caption" style={{ color: theme.text }}>
          {card.number}
        </ThemedText>
      </View>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          style={[styles.verdict, { backgroundColor: verdictFill }]}
          testID={testID !== undefined ? `${testID}.verdict` : undefined}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: verdictOn }} allowFontScaling={false}>
            {verdictGlyph}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  if (onPress === undefined) {
    return <View testID={testID}>{content}</View>;
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled, selected: state === 'correct', busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, { opacity: pressed || disabled ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Campaign 065 touch-target guard: the card visual is sized by its inner
  // container, so the pressable declares the shared floor explicitly.
  pressable: {
    minHeight: MinTouchTarget,
  },
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.medium,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  shape: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -Spacing.one,
    right: -Spacing.one,
    minWidth: 24,
    height: 24,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Verdict badge: opaque verdict-family disc pinned to the card corner. The
  // fill + glyph pair is the non-colour-alone verdict channel.
  verdict: {
    position: 'absolute',
    top: -Spacing.one,
    right: -Spacing.one,
    minWidth: 24,
    height: 24,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
