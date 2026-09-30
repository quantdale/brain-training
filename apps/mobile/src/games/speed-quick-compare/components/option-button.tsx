/**
 * OptionButton — one answer option of the Quick Compare board.
 *
 * Neutral (outline) while the round is open; after the round resolves the
 * parent passes a highlight derived from the reducer's resolved outcome (never
 * from the tap handler): `correct` takes the success-soft fill with a success
 * boundary plus a ✓ badge, `wrong` the danger pair plus a ✕ badge. Fill AND
 * boundary AND glyph, so a verdict never relies on colour alone (R1). The
 * badges are decorative for screen readers; the button's accessible name
 * carries the verdict.
 *
 * During review the correct option stays vivid so a wrong pick is always shown
 * together with the answer (R2), while the wrong pick and untouched options dim
 * to read as locked. The 44 dp floor is a real `minHeight` (not `hitSlop`), so
 * adjacent wrapped options can never overlap.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export interface OptionButtonProps {
  /** Option text (same label the prompt asks the player to choose). */
  readonly label: string;
  readonly testID: string;
  /** Resolved-round highlight; null while the round is open. */
  readonly highlight: 'correct' | 'wrong' | null;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

export const OptionButton = memo(function OptionButton({
  label,
  testID,
  highlight,
  disabled,
  onPress,
}: OptionButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    highlight === 'correct'
      ? theme.successSoft
      : highlight === 'wrong'
        ? theme.dangerSoft
        : 'transparent';
  const borderColor =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : theme.borderStrong;
  const labelColor =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : theme.text;
  const badgeGlyph = highlight === 'correct' ? '✓' : highlight === 'wrong' ? '✕' : null;
  const badgeFill =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : null;
  const badgeOn =
    highlight === 'correct' ? theme.successOn : highlight === 'wrong' ? theme.dangerOn : null;
  const accessibilityLabel =
    highlight === 'correct'
      ? `Correct: ${label}`
      : highlight === 'wrong'
        ? `Wrong pick: ${label}`
        : label;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Answer: ${label}`}
      accessibilityState={{ disabled, selected: highlight === 'correct' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor,
          borderColor,
          borderWidth: highlight !== null ? 3 : 2,
          // The correct answer stays vivid for review; a wrong pick and the
          // untouched options dim to read as locked.
          opacity: pressed || (disabled && highlight !== 'correct') ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="bodyLarge" style={{ color: labelColor }}>
        {label}
      </ThemedText>
      {badgeGlyph !== null && badgeFill !== null && badgeOn !== null ? (
        <View
          testID={`${testID}.verdict`}
          style={[styles.badge, { backgroundColor: badgeFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
            {badgeGlyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    flexGrow: 1,
    minWidth: 120,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
