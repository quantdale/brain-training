/**
 * W16 platform adapter unit checks — pure logic only (capability constants,
 * hit-slop math, keyboard config mapping). No rendering, no native calls.
 */
import { describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import {
  getKeyboardAvoidingConfig,
  hitSlopToTouchTarget,
  isNativePlatform,
  isWebPlatform,
  MIN_TOUCH_TARGET_SIZE,
  platformKind,
  supportsHaptics,
  supportsWebVibration,
} from '@/platform';

describe('platform adapters', () => {
  it('platform kind flags are mutually consistent', () => {
    // jest-expo runs the suite as iOS by default; assert coherence rather
    // than hardcoding the host platform so the check survives preset changes.
    expect(platformKind).toBe(Platform.OS === 'web' ? 'web' : Platform.OS);
    expect(isNativePlatform).toBe(platformKind !== 'web');
    expect(isWebPlatform).toBe(platformKind === 'web');
  });

  it('supportsWebVibration is always false off-web', () => {
    if (Platform.OS === 'web') {
      return; // probe is environment-dependent on web; nothing to assert here
    }
    expect(supportsWebVibration()).toBe(false);
    expect(supportsHaptics()).toBe(true);
  });

  it('hitSlopToTouchTarget returns null once the minimum target is met', () => {
    expect(hitSlopToTouchTarget(MIN_TOUCH_TARGET_SIZE)).toBeNull();
    expect(hitSlopToTouchTarget(48)).toBeNull();
  });

  it('hitSlopToTouchTarget expands small controls symmetrically', () => {
    expect(hitSlopToTouchTarget(32)).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
    expect(hitSlopToTouchTarget(0)).toEqual({ top: 22, bottom: 22, left: 22, right: 22 });
  });

  it('hitSlopToTouchTarget rounds fractional deficits up to reach the minimum', () => {
    // 43.5 → deficit 0.5 → slop 1 per side ⇒ effective 45.5 ≥ 44.
    expect(hitSlopToTouchTarget(43.5)).toEqual({ top: 1, bottom: 1, left: 1, right: 1 });
  });

  it('keyboard config maps the host platform deterministically', () => {
    const config = getKeyboardAvoidingConfig(12);
    if (Platform.OS === 'ios') {
      expect(config).toEqual({ behavior: 'padding', keyboardVerticalOffset: 12 });
    } else {
      expect(config).toEqual({ behavior: undefined, keyboardVerticalOffset: 0 });
    }
  });
});
