/**
 * `IconButton` — circular icon-only control.
 *
 * The accessible name is required at the type level: an icon alone never
 * carries meaning for assistive technology. Press physics, haptics and the
 * touch-target floor come from {@link Tappable}.
 */

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/theme/tokens';
import { pressStyles, Tappable } from './tappable';
import { ICON_BUTTON_SIZE } from './radius';

/** Props accepted by {@link IconButton}. */
export interface IconButtonProps {
  /** Glyph rendered centred in the circle. */
  icon: ReactNode;
  /** Accessible name — required, an unlabelled icon button is a bug. */
  label: string;
  onPress: () => void;
  /** Soft-fill family for the circle; defaults to the sunken surface. */
  tone?: ThemeColor;
  /** Diameter; defaults to the 44 dp touch-target floor. */
  size?: number;
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  tone,
  size = ICON_BUTTON_SIZE,
  disabled = false,
  testID,
  accessibilityHint,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      renderedSize={size}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone ? theme[tone] : theme.surfaceSunken,
        },
        disabled && styles.disabled,
      ]}
      pressedStyle={pressStyles.dimmed}>
      {icon}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
