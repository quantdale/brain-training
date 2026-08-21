// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  createNoopAudioHaptics,
  DEFAULT_AUDIO_HAPTICS_SETTINGS,
  FEEDBACK_EVENT_MAP,
  getAudioHaptics,
  liveAudioHaptics,
  setLiveAudioHaptics,
  SFX_ALIASES,
  type AudioHapticsService,
} from '../audio-haptics';
import { createAudioHaptics, type SfxAssetMap } from '../audio-haptics-real';

/** Deterministic, recording test double for the AudioHapticsService. */
function createRecordingAudioHaptics(
  initial: Partial<{ sfxEnabled: boolean; hapticsEnabled: boolean; musicEnabled: boolean }> = {},
): AudioHapticsService & {
  calls: { playSfx: string[]; haptic: string[]; feedback: string[] };
} {
  const settings = {
    sfxEnabled: true,
    musicEnabled: false,
    hapticsEnabled: true,
    ...initial,
  };
  const calls = { playSfx: [] as string[], haptic: [] as string[], feedback: [] as string[] };
  return {
    calls,
    playSfx(name) {
      if (settings.sfxEnabled) calls.playSfx.push(name);
    },
    haptic(type) {
      if (settings.hapticsEnabled) calls.haptic.push(type);
    },
    feedback(event) {
      calls.feedback.push(event);
      const mapped = FEEDBACK_EVENT_MAP[event];
      if (settings.sfxEnabled) calls.playSfx.push(mapped.sfx);
      if (settings.hapticsEnabled) calls.haptic.push(mapped.haptic);
    },
    setSfxEnabled(v) {
      settings.sfxEnabled = v;
    },
    setMusicEnabled(v) {
      settings.musicEnabled = v;
    },
    setHapticsEnabled(v) {
      settings.hapticsEnabled = v;
    },
    getSettings() {
      return { ...settings };
    },
    isGloballyMuted() {
      return !settings.sfxEnabled && !settings.musicEnabled && !settings.hapticsEnabled;
    },
    async prepare() {},
    release() {},
  };
}

describe('audio/haptics no-op service', () => {
  it('defaults: sfx on, music off, haptics on; muted only when all off', () => {
    const svc = createNoopAudioHaptics();
    expect(svc.getSettings()).toEqual({
      sfxEnabled: true,
      musicEnabled: false,
      hapticsEnabled: true,
    });
    expect(svc.isGloballyMuted()).toBe(false);
    const muted = createNoopAudioHaptics({ sfxEnabled: false, hapticsEnabled: false });
    expect(muted.isGloballyMuted()).toBe(true);
  });

  it('never throws on play/haptic/feedback calls (games remain playable muted)', () => {
    const svc = createNoopAudioHaptics();
    expect(() => svc.playSfx('tile-flip')).not.toThrow();
    expect(() => svc.haptic('success')).not.toThrow();
    expect(() => svc.feedback('correct')).not.toThrow();
  });

  it('matches DEFAULT_AUDIO_HAPTICS_SETTINGS', () => {
    expect(DEFAULT_AUDIO_HAPTICS_SETTINGS).toEqual({
      sfxEnabled: true,
      musicEnabled: false,
      hapticsEnabled: true,
    });
  });
});

describe('feedback event vocabulary + disable state', () => {
  it('feedback maps event -> sfx + haptic and respects sfx/haptics flags', () => {
    const rec = createRecordingAudioHaptics();
    rec.feedback('correct');
    expect(rec.calls.feedback).toEqual(['correct']);
    expect(rec.calls.playSfx).toContain('correct');
    expect(rec.calls.haptic).toContain('light');

    const rec2 = createRecordingAudioHaptics({ sfxEnabled: false });
    rec2.feedback('wrong');
    expect(rec2.calls.playSfx).toEqual([]); // sound suppressed
    expect(rec2.calls.haptic).toContain('warning'); // haptic still plays

    const rec3 = createRecordingAudioHaptics({ hapticsEnabled: false });
    rec3.feedback('success');
    expect(rec3.calls.playSfx).toContain('success');
    expect(rec3.calls.haptic).toEqual([]); // haptic suppressed
  });

  it('globally muted produces no sound and no haptic', () => {
    const rec = createRecordingAudioHaptics({ sfxEnabled: false, hapticsEnabled: false });
    rec.feedback('record');
    expect(rec.calls.playSfx).toEqual([]);
    expect(rec.calls.haptic).toEqual([]);
    expect(rec.isGloballyMuted()).toBe(true);
  });
});

describe('live service injection (production SDK injection)', () => {
  afterEach(() => {
    setLiveAudioHaptics(createNoopAudioHaptics());
  });

  it('getAudioHaptics returns the injected service and liveAudioHaptics delegates', () => {
    const rec = createRecordingAudioHaptics();
    setLiveAudioHaptics(rec);
    expect(getAudioHaptics()).toBe(rec);
    liveAudioHaptics.feedback('reward');
    expect(rec.calls.feedback).toEqual(['reward']);
    expect(rec.calls.playSfx).toContain('reward');
    expect(rec.calls.haptic).toContain('success');
  });
});

describe('SFX alias coverage (no game sound dropped)', () => {
  const CANONICAL = new Set(Object.values(FEEDBACK_EVENT_MAP).map((m) => m.sfx));

  it('canonical asset set is exactly the seven bundled sounds', () => {
    expect([...CANONICAL].sort()).toEqual([
      'correct',
      'failure',
      'record',
      'reward',
      'success',
      'tap',
      'wrong',
    ]);
  });

  it('every alias target is a canonical asset name (never another alias)', () => {
    for (const target of Object.values(SFX_ALIASES)) {
      // The real engine resolves exactly one hop (SFX_ALIASES[name] ?? name),
      // so an alias pointing at another alias would silently drop the sound.
      expect(CANONICAL.has(target)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(SFX_ALIASES, target)).toBe(false);
    }
  });

  it('regression: catalog sfx names that once fell through unaliased now resolve', () => {
    // language-context-fit and flexibility-cue-shift shipped these names in
    // production before their aliases existed — they resolved to themselves,
    // matched no asset, and played nothing. See catalog-contracts.test.ts for
    // the catalog-wide scan that keeps this class of bug closed.
    for (const name of [
      'language-context-fit-correct',
      'language-context-fit-wrong',
      'flexibility-cue-correct',
      'flexibility-cue-wrong',
    ]) {
      const canonical = SFX_ALIASES[name] ?? name;
      expect(CANONICAL.has(canonical)).toBe(true);
    }
  });
});

describe('real engine (expo-audio + expo-haptics, mocked)', () => {
  
  const audio: any = jest.requireMock('expo-audio');
  
  const haptics: any = jest.requireMock('expo-haptics');
  
  const playersBySource = new Map<number, any>();

  const ASSETS: SfxAssetMap = {
    tap: 1,
    correct: 2,
    wrong: 3,
    success: 4,
    failure: 5,
    record: 6,
    reward: 7,
  };

  beforeEach(() => {
    playersBySource.clear();
    const create = audio.createAudioPlayer as jest.Mock<any>;
    create.mockImplementation((src: number) => {
      const player = {
        src,
        play: jest.fn(),
        seekTo: jest.fn(),
        remove: jest.fn(),
        replace: jest.fn(),
      };
      playersBySource.set(src, player);
      return player;
    });
    (haptics.impactAsync as jest.Mock).mockClear();
    (haptics.notificationAsync as jest.Mock).mockClear();
    (audio.setAudioModeAsync as jest.Mock).mockClear();
  });

  it('prepare configures audio mode and preloads assets', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    // All canonical assets have a player created during preload.
    for (const src of Object.values(ASSETS)) {
      expect(playersBySource.has(src)).toBe(true);
    }
  });

  it('playSfx resolves aliases to the correct asset and plays it', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    engine.playSfx('memory-tile-correct'); // alias -> correct -> asset 2
    const player = playersBySource.get(2);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('disabled sfx does not trigger playback', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    engine.playSfx('correct'); // enabled -> 1 play
    expect(playersBySource.get(2).play).toHaveBeenCalledTimes(1);
    engine.setSfxEnabled(false);
    engine.playSfx('correct'); // disabled -> no new play
    expect(playersBySource.get(2).play).toHaveBeenCalledTimes(1);
  });

  it('feedback triggers the right haptic; disabled haptics suppress it', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    engine.feedback('success');
    expect(haptics.notificationAsync).toHaveBeenCalledWith('success');
    engine.setHapticsEnabled(false);
    engine.feedback('failure');
    expect(haptics.notificationAsync).toHaveBeenCalledTimes(1); // not called again
  });

  it('release removes players and disables further playback', async () => {
    const engine = createAudioHaptics({ sfxAssets: ASSETS });
    await engine.prepare();
    const removeSpy = playersBySource.get(1).remove;
    engine.release();
    expect(removeSpy).toHaveBeenCalled();
    engine.playSfx('tap'); // disposed -> no-op, no new player created/played
    expect(playersBySource.get(1).play).not.toHaveBeenCalled();
  });
});
