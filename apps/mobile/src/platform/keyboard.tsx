/**
 * Keyboard avoidance adapter — shared configuration for `KeyboardAvoidingView`
 * (campaign009 xplat audit: the codebase had no keyboard handling at all; this
 * gives screens one seam instead of per-screen platform branches).
 *
 * Platform differences:
 * - iOS: `padding` behavior — the container's padding grows as the keyboard
 *   rises; `keyboardVerticalOffset` compensates for any header above the view.
 * - Android: the default `adjustResize` window mode already resizes the root
 *   view, so no behavior is injected (adding one double-compensates).
 * - Web: no OS keyboard inset model; render a plain passthrough container.
 */

import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface KeyboardAvoidingConfig {
  /** KeyboardAvoidingView behavior; `undefined` lets the platform default apply. */
  behavior?: 'height' | 'padding' | 'position';
  /** Offset between the top of the user screen and this view (headers, etc.). */
  keyboardVerticalOffset: number;
}

/** Platform-appropriate keyboard config (plain function — safe to call anywhere). */
export function getKeyboardAvoidingConfig(keyboardVerticalOffset = 0): KeyboardAvoidingConfig {
  if (Platform.OS === 'ios') {
    return { behavior: 'padding', keyboardVerticalOffset };
  }
  // Android relies on adjustResize; web has no keyboard inset model.
  return { behavior: undefined, keyboardVerticalOffset: 0 };
}

export interface KeyboardAvoidingAreaProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Semantic test hook id. */
  testID?: string;
}

/**
 * Drop-in keyboard-aware container. Applies the platform-appropriate
 * `KeyboardAvoidingView` config on native; on web it is a plain `View`.
 */
export function KeyboardAvoidingArea({ children, style, testID }: KeyboardAvoidingAreaProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  }
  const config = getKeyboardAvoidingConfig();
  return (
    <KeyboardAvoidingView style={style} testID={testID} {...config}>
      {children}
    </KeyboardAvoidingView>
  );
}
