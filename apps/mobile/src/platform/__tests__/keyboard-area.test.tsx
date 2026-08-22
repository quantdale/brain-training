/**
 * W16 campaign012 — KeyboardAvoidingArea mount-path contract.
 *
 * Pins the platform split documented on the seam (`@/platform/keyboard`):
 * - iOS: a real `KeyboardAvoidingView` mounts with `padding` behavior and the
 *   caller's `keyboardVerticalOffset` forwarded verbatim.
 * - Android/web: NO avoidance component mounts — Android's manifest-pinned
 *   `adjustResize` owns insets (`windowSoftInputMode` in
 *   `android/app/src/main/AndroidManifest.xml`); web has no OS keyboard inset
 *   model. Guards against accidental double-compensation if someone
 *   reintroduces a default-behavior KAV on those platforms.
 *
 * Detection strategy: RN's real `KeyboardAvoidingView` subscribes to
 * `Keyboard` events in `componentDidMount` (iOS: willShow/willHide; Android:
 * didShow/didHide), while a plain passthrough `View` subscribes to nothing —
 * so `jest.spyOn(Keyboard, 'addListener')` is a precise, dependency-free
 * mount signal. Traversal-based detection is unusable here because
 * jest-expo's node environment collapses composite containers out of the
 * RNTL instance tree (only leaf hosts like Text remain). `Platform.OS` is
 * read by the seam at render time, so `jest.replaceProperty` switches paths
 * within one suite regardless of which platform the preset loaded as.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Keyboard, Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import {
  getKeyboardAvoidingConfig,
  KeyboardAvoidingArea,
} from '@/platform';

describe('KeyboardAvoidingArea mount-path contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ios: mounts an avoidance view (keyboard listeners subscribed)', async () => {
    const addSpy = jest.spyOn(Keyboard, 'addListener');
    const replacedOs = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      const screen = await render(
        <KeyboardAvoidingArea testID="kba">
          <Text>content</Text>
        </KeyboardAvoidingArea>,
      );
      expect(screen.getByText('content')).toBeTruthy();
      expect(addSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      replacedOs.restore();
    }
  });

  it('ios: config maps padding behavior with the caller offset forwarded', () => {
    const replacedOs = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      expect(getKeyboardAvoidingConfig()).toEqual({
        behavior: 'padding',
        keyboardVerticalOffset: 0,
      });
      expect(getKeyboardAvoidingConfig(88)).toEqual({
        behavior: 'padding',
        keyboardVerticalOffset: 88,
      });
    } finally {
      replacedOs.restore();
    }
  });

  it('android: plain passthrough — no keyboard listeners, content renders', async () => {
    const addSpy = jest.spyOn(Keyboard, 'addListener');
    const replacedOs = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const screen = await render(
        <KeyboardAvoidingArea testID="kba">
          <Text>plain</Text>
        </KeyboardAvoidingArea>,
      );
      expect(screen.getByText('plain')).toBeTruthy();
      expect(addSpy).not.toHaveBeenCalled();
    } finally {
      replacedOs.restore();
    }
  });

  it('web: plain passthrough — no keyboard listeners, content renders', async () => {
    const addSpy = jest.spyOn(Keyboard, 'addListener');
    const replacedOs = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const screen = await render(
        <KeyboardAvoidingArea testID="kba">
          <Text>plain</Text>
        </KeyboardAvoidingArea>,
      );
      expect(screen.getByText('plain')).toBeTruthy();
      expect(addSpy).not.toHaveBeenCalled();
    } finally {
      replacedOs.restore();
    }
  });
});
