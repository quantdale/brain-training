/**
 * Platform capability queries — one place for `Platform.OS` branching so
 * feature code never sprinkles raw `Platform.select`/`Platform.OS` checks
 * (campaign009 xplat audit hygiene follow-up).
 *
 * Web-only environment probes are short-circuited behind the platform check
 * before touching DOM globals, preserving the audit's "no DOM leakage in
 * native-bundled files" invariant (Hermes has no `window`, but the guard keeps
 * intent explicit and the code safe under any bundler target).
 */

import { Platform } from 'react-native';

/** Coarse platform kind, narrowed to the platforms this app supports. */
export type PlatformKind = 'ios' | 'android' | 'web';

export const platformKind: PlatformKind =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

export const isNativePlatform: boolean = platformKind !== 'web';

export const isWebPlatform: boolean = platformKind === 'web';

/**
 * Whether differentiated haptic feedback can actually fire. Native platforms
 * ship expo-haptics backends; web degrades to `navigator.vibrate` (or a
 * silent no-op), so callers may use "false" to skip haptic-only affordances.
 */
export function supportsHaptics(): boolean {
  if (isNativePlatform) {
    return true;
  }
  return supportsWebVibration();
}

/**
 * Web-only vibration probe (`navigator.vibrate`). Always false off-web.
 * expo-haptics already fails open internally; this exists for callers that
 * want to decide BEFORE calling (e.g. hiding a "vibration" settings row).
 */
export function supportsWebVibration(): boolean {
  if (!isWebPlatform || typeof window === 'undefined') {
    return false;
  }
  return typeof window.navigator !== 'undefined' && 'vibrate' in window.navigator;
}
