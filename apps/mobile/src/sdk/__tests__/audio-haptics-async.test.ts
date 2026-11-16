import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createAudioHaptics, type SfxAssetMap } from '../audio-haptics-real';

const audio = jest.requireMock('expo-audio') as {
  createAudioPlayer: jest.Mock;
  setAudioModeAsync: jest.Mock<() => Promise<void>>;
};
const assets: SfxAssetMap = { tap: 1, correct: 2, wrong: 3, success: 4, failure: 5, record: 6, reward: 7 };
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const player = { seekTo: jest.fn<() => Promise<void>>(), play: jest.fn(), remove: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  player.seekTo.mockReset().mockResolvedValue(undefined);
  audio.createAudioPlayer.mockReturnValue(player);
  audio.setAudioModeAsync.mockReset().mockResolvedValue(undefined);
});

describe('audio-haptics-real async ownership', () => {
  it('handles a rejected seek and still plays subsequent feedback', async () => {
    // Assert that a rejection handler is attached without creating an unhandled
    // rejected promise in the red run (which would crash the Jest process).
    const seek = Promise.reject(new Error('seek unavailable'));
    const then = jest.spyOn(seek, 'then');
    const caught = jest.spyOn(seek, 'catch');
    void seek.catch(() => undefined);
    caught.mockClear();
    player.seekTo.mockReturnValueOnce(seek);
    const engine = createAudioHaptics({ sfxAssets: assets });
    engine.playSfx('tap');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(then.mock.calls.some((args) => typeof args[1] === 'function') || caught.mock.calls.length > 0).toBe(true);
    expect(player.play).not.toHaveBeenCalled();
    engine.playSfx('correct');
    await Promise.resolve();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it.each(['mute', 'release'] as const)('does not play a delayed seek after %s', async (action) => {
    const seek = deferred();
    player.seekTo.mockReturnValueOnce(seek.promise);
    const engine = createAudioHaptics({ sfxAssets: assets });
    engine.playSfx('tap');
    expect(player.play).not.toHaveBeenCalled();
    if (action === 'mute') engine.setSfxEnabled(false);
    else engine.release();
    seek.resolve();
    await Promise.resolve();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('swallows synchronous seek and asynchronous play failures', async () => {
    player.seekTo.mockImplementationOnce(() => { throw new Error('no backend'); });
    const engine = createAudioHaptics({ sfxAssets: assets });
    expect(() => engine.playSfx('tap')).not.toThrow();
    player.play.mockImplementationOnce(() => { throw new Error('play unavailable'); });
    engine.playSfx('tap');
    await new Promise<void>((resolve) => setImmediate(resolve));
    engine.playSfx('tap');
    await Promise.resolve();
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it.each(['resolve', 'reject'] as const)('never allocates after release while prepare will %s', async (outcome) => {
    const mode = deferred();
    audio.setAudioModeAsync.mockReturnValueOnce(mode.promise);
    const disposed = createAudioHaptics({ sfxAssets: assets });
    const preparing = disposed.prepare();
    disposed.release();
    if (outcome === 'resolve') mode.resolve();
    else mode.reject(new Error('configuration failed'));
    await preparing;
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    disposed.playSfx('tap');
    await disposed.prepare();
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();

    // A fresh StrictMode-style setup remains usable after the old cleanup.
    const fresh = createAudioHaptics({ sfxAssets: assets });
    await fresh.prepare();
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(7);
    fresh.release();
    expect(player.remove).toHaveBeenCalledTimes(7);
  });
});
