/**
 * W15 campaign011 — fail-open invariants of the real audio/haptics engine
 * (`audio-haptics-real.ts`).
 *
 * Regression pins for the campaign009 audit platform branch:
 * - `fireAndForgetHaptic` MUST attach a `.catch` to every expo-haptics promise.
 *   The native calls reject ASYNCHRONOUSLY when a platform/hardware backend is
 *   missing, so a synchronous try/catch cannot cover them; a bare `void` would
 *   escalate to an unhandled-rejection crash (Node ≥15 fails fast on those,
 *   and Hermes surfaces them as fatal errors). Each test installs a process
 *   `unhandledRejection` listener and asserts it never fires — if someone
 *   removes the `.catch`, these tests go red deterministically.
 * - A rejected capability call must not poison the engine: later calls still
 *   attempt their backend, other channels (sfx) keep working, `prepare()` still
 *   completes when `setAudioModeAsync` rejects, and `release()` stays clean.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createAudioHaptics, type SfxAssetMap } from '../audio-haptics-real';

const audio: any = jest.requireMock('expo-audio');
const haptics: any = jest.requireMock('expo-haptics');

const ASSETS: SfxAssetMap = {
  tap: 1,
  correct: 2,
  wrong: 3,
  success: 4,
  failure: 5,
  record: 6,
  reward: 7,
};

/** Drain the microtask queue far enough for unhandled-rejection detection. */
function flushRejectionTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('fail-open: async haptic rejections are swallowed (W15 regression)', () => {
  let unhandled: unknown[];
  let listener: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    listener = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', listener);
    // Reset both global mocks to their setup.js resolve implementations.
    haptics.impactAsync.mockImplementation(() => Promise.resolve());
    haptics.notificationAsync.mockImplementation(() => Promise.resolve());
    audio.setAudioModeAsync.mockImplementation(() => Promise.resolve());
  });

  afterEach(async () => {
    await flushRejectionTurn();
    process.off('unhandledRejection', listener);
    jest.clearAllMocks();
  });

  it('impactAsync rejection produces no unhandled rejection', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    haptics.impactAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('no haptic backend'))
    );

    expect(() => engine.haptic('medium')).not.toThrow();
    await flushRejectionTurn();

    expect(haptics.impactAsync).toHaveBeenCalledWith('medium');
    expect(unhandled).toEqual([]);
  });

  it('notificationAsync rejection produces no unhandled rejection', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    haptics.notificationAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('notification backend missing'))
    );

    expect(() => engine.feedback('success')).not.toThrow();
    await flushRejectionTurn();

    expect(haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(unhandled).toEqual([]);
  });

  it('a rejected haptic does not poison later calls or other channels', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();

    haptics.notificationAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('transient failure'))
    );
    engine.haptic('success');
    await flushRejectionTurn();
    expect(unhandled).toEqual([]);

    // Engine must still be fully operational after the swallowed rejection.
    engine.playSfx('tap');
    expect(audio.createAudioPlayer).toHaveBeenCalledWith(1);
    engine.haptic('light');
    expect(haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('prepare() resolves even when setAudioModeAsync rejects (best-effort mode)', async () => {
    audio.setAudioModeAsync.mockImplementation(() =>
      Promise.reject(new Error('audio session unavailable'))
    );
    const engine = createAudioHaptics({ sfxAssets: ASSETS });

    await expect(engine.prepare()).resolves.toBeUndefined();

    // Preload still ran despite the failed audio-mode configuration.
    for (const src of Object.values(ASSETS)) {
      expect(audio.createAudioPlayer).toHaveBeenCalledWith(src);
    }
  });

  it('release() after rejected haptics removes players without throwing', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    haptics.impactAsync.mockImplementation(() =>
      Promise.reject(new Error('backend gone mid-session'))
    );
    engine.haptic('heavy');
    await flushRejectionTurn();

    expect(() => engine.release()).not.toThrow();
    expect(() => engine.haptic('light')).not.toThrow(); // disposed no-op path
    await flushRejectionTurn();
    expect(unhandled).toEqual([]);
  });
});
