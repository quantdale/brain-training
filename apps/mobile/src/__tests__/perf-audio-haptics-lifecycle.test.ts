/**
 * Performance guards — audio/haptics object lifecycle (campaign 009 W13).
 *
 * The real engine (`@/sdk/audio-haptics-real`) is the only production owner of
 * native audio players. Its lifecycle contract, guarded here deterministically
 * against the jest-expo `expo-audio` mock (see `jest/setup.js`):
 *
 * 1. `prepare()` preloads exactly one player per asset — no per-play allocation.
 * 2. Repeated `playSfx` reuses cached players (no player churn on hot tap paths).
 * 3. Disabled channels short-circuit BEFORE any player lookup/allocation.
 * 4. `release()` disposes every player; a released engine is an inert no-op and
 *    never lazily recreates players (no leaks across provider remounts).
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { createAudioPlayer } from 'expo-audio';

import { createAudioHaptics, type SfxAssetMap } from '@/sdk/audio-haptics-real';

const ASSETS: SfxAssetMap = { tap: 101, correct: 102, wrong: 103 };

const createAudioPlayerMock = createAudioPlayer as unknown as jest.Mock<any>;

/** Player handles handed out by the mocked expo-audio, in creation order. */
function createdPlayers(): unknown[] {
  return createAudioPlayerMock.mock.results.map((r) => r.value);
}

describe('perf: audio engine preloads once and reuses players', () => {
  beforeEach(() => {
    createAudioPlayerMock.mockClear();
  });

  it('prepare() creates exactly one player per asset; repeated prepare adds none', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(3);

    await engine.prepare(); // idempotent
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(3);
  });

  it('repeated playSfx reuses cached players (zero allocations on hot path)', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(3);

    for (let i = 0; i < 50; i++) {
      engine.playSfx('tap');
      engine.playSfx('correct');
    }
    // No lazy allocation beyond the preload set.
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(3);
  });

  it('alias resolution still hits the cached canonical player', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    // 'memory-tile-correct' is an alias of 'correct' (SFX_ALIASES).
    engine.playSfx('memory-tile-correct');
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(3);
  });

  it('disabled sfx channel short-circuits before any player work', async () => {
    const engine = createAudioHaptics({
      initialSettings: { sfxEnabled: false },
      sfxAssets: ASSETS,
    });
    engine.playSfx('tap');
    engine.playSfx('correct');
    expect(createAudioPlayerMock).not.toHaveBeenCalled();

    // Enabling later resumes normal operation.
    engine.setSfxEnabled(true);
    engine.playSfx('tap');
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(1);
  });
});

describe('perf: release() disposes every player and freezes the engine', () => {
  beforeEach(() => {
    createAudioPlayerMock.mockClear();
  });

  it('release() removes all players; post-release playSfx neither plays nor reallocates', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    const players = createdPlayers();
    expect(players.length).toBe(3);

    // The mocked players expose plain class methods — spy on the native
    // dispose call before releasing.
    const removeSpies = players.map((player) =>
      jest.spyOn(player as { remove: () => void }, 'remove'),
    );

    engine.release();
    // Every mocked player saw remove() (the native dispose call).
    for (const spy of removeSpies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    createAudioPlayerMock.mockClear();
    expect(() => engine.playSfx('tap')).not.toThrow();
    expect(() => engine.haptic('light')).not.toThrow();
    expect(createAudioPlayerMock).not.toHaveBeenCalled();
  });

  it('a fresh engine after release does not inherit disposed players (remount safety)', async () => {
    const first = createAudioHaptics({ sfxAssets: ASSETS });
    await first.prepare();
    first.release();

    const second = createAudioHaptics({ sfxAssets: ASSETS });
    await second.prepare();
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(6); // 3 + 3 fresh

    const secondPlayers = createdPlayers().slice(3);
    second.playSfx('tap');
    expect(
      (secondPlayers[0] as { played: boolean }).played,
    ).toBe(true);
    second.release();
  });
});
