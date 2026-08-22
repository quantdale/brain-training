/**
 * Keyboard avoidance adapter — shared configuration for `KeyboardAvoidingView`
 * (campaign009 xplat audit: the codebase had no keyboard handling at all; this
 * gives screens one seam instead of per-screen platform branches).
 *
 * Platform differences:
 * - iOS: `padding` behavior — the container's bottom padding grows as the
 *   keyboard rises; `keyboardVerticalOffset` compensates for any header above
 *   the view.
 * - Android: the manifest pins `adjustResize`
 *   (`android/app/src/main/AndroidManifest.xml`, `windowSoftInputMode`), so
 *   the OS already resizes the root view and NO component-level avoidance is
 *   injected (adding one would double-compensate). Verified against the RN
 *   0.86.2 source: a `KeyboardAvoidingView` without a `behavior` renders its
 *   default branch — a plain `View` — so rendering a plain `View` here is
 *   output-identical while skipping the component's dead keyboard
 *   subscriptions.
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
  /**
   * Distance between the top of the user screen and this view (header height).
   * Only affects platforms with component-level avoidance (iOS today); other
   * platforms ignore it because their inset mechanism is OS-driven.
   */
  keyboardVerticalOffset?: number;
  /** Semantic test hook id. */
  testID?: string;
}

/**
 * Drop-in keyboard-aware container. Applies the platform-appropriate
 * `KeyboardAvoidingView` config on iOS; on Android/web it is a plain `View`.
 */
export function KeyboardAvoidingArea({
  children,
  style,
  keyboardVerticalOffset = 0,
  testID,
}: KeyboardAvoidingAreaProps) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={style}
        testID={testID}
        {...getKeyboardAvoidingConfig(keyboardVerticalOffset)}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View style={style} testID={testID}>
      {children}
    </View>
  );
}
