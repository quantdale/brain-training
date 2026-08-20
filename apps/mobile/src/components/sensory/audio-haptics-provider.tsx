/**
 * App-level audio/haptics provider.
 *
 * This is the single production injection point for the real
 * `AudioHapticsService` (constitution §20 + GAME_SDK.md "production SDK
 * injection instead of noopAudioHaptics"). It:
 * - builds the real engine once with the bundled SFX assets,
 * - registers it as the live service so game code referencing
 *   `liveAudioHaptics` transparently uses it,
 * - preloads assets on mount and releases them on unmount,
 * - keeps the engine's enable flags in sync with the persisted user settings.
 *
 * The provider imports the native engine directly; game modules never do, so
 * the shared SDK and unit tests stay free of `expo-audio` / `expo-haptics`.
 */
import { useEffect, useRef, type ReactNode } from 'react';

import { useSettings } from '@/components/settings/settings-provider';
import { createAudioHaptics, type SfxAssetMap } from '@/sdk/audio-haptics-real';
import {
  createNoopAudioHaptics,
  setLiveAudioHaptics,
  type AudioHapticsService,
} from '@/sdk';

// Metro resolves these `require`s to numeric asset ids at build time.
const SFX_ASSETS: SfxAssetMap = {
  tap: require('../../../assets/sfx/tap.wav'),
  correct: require('../../../assets/sfx/correct.wav'),
  wrong: require('../../../assets/sfx/wrong.wav'),
  success: require('../../../assets/sfx/success.wav'),
  failure: require('../../../assets/sfx/failure.wav'),
  record: require('../../../assets/sfx/record.wav'),
  reward: require('../../../assets/sfx/reward.wav'),
};

export function AudioHapticsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const serviceRef = useRef<AudioHapticsService | null>(null);

  useEffect(() => {
    // Create the engine in the effect (not during render) so a StrictMode
    // remount recreates a fresh, non-disposed engine rather than reusing a
    // released one.
    const service = createAudioHaptics({
      initialSettings: {
        sfxEnabled: settings.sfx,
        hapticsEnabled: settings.haptics,
        musicEnabled: false,
      },
      sfxAssets: SFX_ASSETS,
    });
    serviceRef.current = service;
    setLiveAudioHaptics(service);
    void service.prepare();
    return () => {
      // Restore the safe default and release native players on unmount.
      setLiveAudioHaptics(createNoopAudioHaptics());
      service.release();
      serviceRef.current = null;
    };
    // Intentionally mount-once; settings changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    serviceRef.current?.setSfxEnabled(settings.sfx);
  }, [settings.sfx]);

  useEffect(() => {
    serviceRef.current?.setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  return <>{children}</>;
}
