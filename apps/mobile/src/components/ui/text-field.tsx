/**
 * `TextField` — labelled single-line input.
 *
 * Label above, token-styled container around an RN `TextInput`, and the
 * support line below (error wins over hint). The container holds the 44 dp
 * floor; the border carries state: `border` idle, `borderStrong` focused,
 * `danger` when `error` is set. The clear affordance is icon-only, so it
 * carries its own accessible name and inherits the 44 dp target from
 * {@link Tappable}.
 */

import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Fonts, MinTouchTarget, Radii, Spacing, Typography } from '@/theme/tokens';
import { HAIRLINE } from './radius';
import { Tappable } from './tappable';

/** Props accepted by {@link TextField}. */
export interface TextFieldProps {
  /** Caption above the input; also the default accessible name. */
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Error copy below the input; switches the border to `danger`. */
  error?: string;
  /** Helper copy below the input (hidden while `error` is set). */
  hint?: string;
  /** Shows the clear affordance while there is text to clear. */
  onClear?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  maxLength?: number;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  onClear,
  disabled = false,
  testID,
  accessibilityLabel,
  autoFocus,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  maxLength,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const showClear = onClear !== undefined && value.length > 0 && !disabled;
  // Error dominates focus: a focused-but-invalid field must stay red.
  const borderColor = error ? theme.danger : focused ? theme.borderStrong : theme.border;
  const support = error ?? hint;

  return (
    <View style={styles.root}>
      {label ? <ThemedText type="label">{label}</ThemedText> : null}
      <View
        style={[
          styles.box,
          { backgroundColor: theme.surface, borderColor },
          disabled && styles.disabled,
        ]}>
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: theme.text }]}
        />
        {showClear ? (
          <Tappable
            accessibilityLabel={label ? `Clear ${label}` : 'Clear input'}
            onPress={onClear}
            feedback="tap"
            style={styles.clear}>
            <ThemedText type="body" themeColor="textSecondary" allowFontScaling={false}>
              ×
            </ThemedText>
          </Tappable>
        ) : null}
      </View>
      {support ? (
        <ThemedText type="caption" themeColor={error ? 'dangerText' : 'textSecondary'}>
          {support}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    rowGap: Spacing.one,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    // minHeight (not height) so a 2x system font scale grows the box
    // instead of clipping the input.
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderWidth: HAIRLINE,
    borderRadius: Radii.medium,
  },
  input: {
    flex: 1,
    // The measured interactive node is the input itself, so it carries the
    // 44 dp target rather than inheriting it from the surrounding box.
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.sans,
    fontSize: Typography.body.size,
    lineHeight: Typography.body.lineHeight,
    fontWeight: Typography.body.weight,
  },
  clear: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
