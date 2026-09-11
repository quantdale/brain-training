/**
 * `Chip` — pill selector for library filters and template pickers.
 *
 * Selected is the `accent` fill with `accentOn` copy; unselected is `surface`
 * with a hairline `border`. Selection is exposed through
 * `accessibilityState.selected` so a screen reader announces filter state.
 * The visual is compact; {@link Tappable} expands the hit area to the 44 dp
 * floor from the nominal visual height below.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Spacing, Typography } from '@/theme/tokens';
import { HAIRLINE, RADIUS_CAP } from './radius';
import { Tappable } from './tappable';

/** Props accepted by {@link Chip}. */
export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Trailing tally (e.g. games in this filter). Folded into the name. */
  count?: number;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

// Nominal visual height the hit area is expanded from: vertical padding +
// the label line height. Token-derived so a type-scale change keeps the
// 44 dp guarantee without anyone updating a literal.
const CHIP_NOMINAL_HEIGHT = Spacing.two * 2 + Typography.label.lineHeight;

export function Chip({
  label,
  selected = false,
  onPress,
  count,
  disabled = false,
  testID,
  accessibilityLabel,
}: ChipProps) {
  const theme = useTheme();
  const labelColor = selected ? 'accentOn' : 'textSecondary';
  const name = accessibilityLabel ?? (count !== undefined ? `${label}, ${count}` : label);

  const content = (
    <>
      <ThemedText type="label" themeColor={labelColor} numberOfLines={1}>
        {label}
      </ThemedText>
      {count !== undefined ? (
        <ThemedText type="caption" themeColor={labelColor} numberOfLines={1}>
          {String(count)}
        </ThemedText>
      ) : null}
    </>
  );

  const presentation = {
    backgroundColor: selected ? theme.accent : theme.surface,
    ...(selected ? null : { borderWidth: HAIRLINE, borderColor: theme.border }),
  };

  if (onPress === undefined) {
    return (
      <View testID={testID} style={[styles.base, presentation]}>
        {content}
      </View>
    );
  }

  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={name}
      accessibilityState={{ selected, disabled }}
      renderedSize={CHIP_NOMINAL_HEIGHT}
      style={[styles.base, presentation, disabled && styles.disabled]}
      pressedStyle={{ backgroundColor: selected ? theme.accentStrong : theme.backgroundSelected }}>
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: RADIUS_CAP,
    minWidth: MinTouchTarget,
  },
  disabled: {
    opacity: 0.5,
  },
});
