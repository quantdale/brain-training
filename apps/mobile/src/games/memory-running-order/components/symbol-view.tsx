/**
 * SymbolView — renders one Running Order symbol (glyph + color).
 *
 * Every symbol is distinguishable by color AND shape (glyph) so it never
 * relies on a single channel. The accessibility label is the symbol's own
 * identity (e.g. "red circle") — during the reveal/study phase that is the
 * intended content; during input it is merely the alphabet shown to every
 * player, and the answer row shows only the player's OWN selections, so the
 * correct sequence is never leaked through the accessibility tree.
 *
 * When `onPress` is provided the view becomes a pressable control (used for the
 * input palette and the tutorial demo); otherwise it is a static display.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { symbolById, type RunningOrderSymbol } from '../symbols';

export interface SymbolViewProps {
  symbolId: number;
  /** Font size of the glyph. */
  size?: number;
  testID?: string;
  /** Optional highlight ring (used in the tutorial demo / answer display). */
  highlighted?: boolean;
  /** When provided, the view becomes a pressable control. */
  onPress?: () => void;
  /** Disables presses (e.g. when the answer is full). */
  disabled?: boolean;
  /** Stable accessibility label override (defaults to the symbol identity). */
  accessibilityLabel?: string;
}

export const SymbolView = memo(function SymbolView({
  symbolId,
  size = 56,
  testID,
  highlighted = false,
  onPress,
  disabled = false,
  accessibilityLabel,
}: SymbolViewProps) {
  const sym: RunningOrderSymbol = symbolById(symbolId);
  const label = accessibilityLabel ?? sym.label;
  const inner = (
    <View testID={onPress ? undefined : testID} accessibilityLabel={label} style={[styles.wrap, highlighted && styles.highlighted]}>
      <Text style={[styles.glyph, { color: sym.color, fontSize: size }]}>{sym.glyph}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 6,
  },
  highlighted: {
    borderWidth: 3,
    borderColor: '#FBBF24',
  },
  glyph: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  pressable: {
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
