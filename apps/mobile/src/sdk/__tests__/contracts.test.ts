// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { noopXpRatingHook } from '../types/results';
import type { NormalizedPerformance, XpRatingContext } from '../types/results';
import { createDiagnosticMetadata } from '../types/diagnostics';
import { createNoopQaForceStateHooks, isDevBuild, assertDevOnly } from '../types/qa';
import { createNoopAudioHaptics, noopAudioHaptics } from '../audio-haptics';
import { createPauseOverlaySpec } from '../pause';
import { SDK_VERSION } from '../version';

const PERF: NormalizedPerformance = Object.freeze({ value: 0.8, scale: '0..1' });
const CONTEXT: XpRatingContext = Object.freeze({ gameId: 'g', difficulty: 'normal', durationMs: 1000 });

describe('XpRatingHook no-op default', () => {
  it('awards 0 XP and no rating movement until Phase 2', () => {
    expect(noopXpRatingHook.computeXp(PERF, CONTEXT)).toBe(0);
    expect(noopXpRatingHook.computeRatingDeltas(PERF, CONTEXT)).toEqual([]);
  });
});

describe('createDiagnosticMetadata', () => {
  it('fills sdkVersion with the current SDK version', () => {
    const meta = createDiagnosticMetadata({
      gameId: 'g',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: 'seed-1',
      difficulty: 'hard',
      startedAtMs: 1000,
      activeDurationMs: 5000,
      pausedDurationMs: 250,
    });
    expect(meta.sdkVersion).toBe(SDK_VERSION);
    expect(meta.gameId).toBe('g');
    expect(meta.seed).toBe('seed-1');
  });

  it('honors an explicit sdkVersion override (old-format replay)', () => {
    const meta = createDiagnosticMetadata({
      gameId: 'g',
      gameVersion: '0.9.0',
      generatorVersion: null,
      seed: null,
      difficulty: 'easy',
      startedAtMs: 0,
      activeDurationMs: 1,
      pausedDurationMs: 0,
      sdkVersion: '0.0.9',
    });
    expect(meta.sdkVersion).toBe('0.0.9');
  });
});

describe('QA force-state hooks', () => {
  it('no-op hooks are inert and safe in dev builds', () => {
    const hooks = createNoopQaForceStateHooks('game-x');
    expect(hooks.gameId).toBe('game-x');
    expect(() => hooks.forceWin()).not.toThrow();
    expect(() => hooks.forceLose()).not.toThrow();
    expect(() => hooks.forceState?.({ round: 3 })).not.toThrow();
  });

  it('isDevBuild/assertDevOnly reflect the dev runtime', () => {
    expect(typeof isDevBuild()).toBe('boolean');
    expect(() => assertDevOnly()).not.toThrow(); // jest-expo runs with __DEV__ true
  });
});

describe('audio/haptics no-op service', () => {
  it('defaults: sfx on, music off, haptics on; muted only when all off', () => {
    const svc = createNoopAudioHaptics();
    expect(svc.getSettings()).toEqual({ sfxEnabled: true, musicEnabled: false, hapticsEnabled: true });
    expect(svc.isGloballyMuted()).toBe(false);
  });

  it('updates flags and tracks global mute', () => {
    const svc = createNoopAudioHaptics();
    expect(svc.isGloballyMuted()).toBe(false);
    svc.setSfxEnabled(false);
    svc.setHapticsEnabled(false);
    // Music is off by default, so with sfx+haptics off every channel is muted.
    expect(svc.isGloballyMuted()).toBe(true);
    svc.setMusicEnabled(true);
    expect(svc.isGloballyMuted()).toBe(false);
    svc.setMusicEnabled(false);
    expect(svc.isGloballyMuted()).toBe(true);
  });

  it('never throws on play/haptic calls (games remain playable muted)', () => {
    expect(() => noopAudioHaptics.playSfx('tile-flip')).not.toThrow();
    expect(() => noopAudioHaptics.haptic('success')).not.toThrow();
  });
});

describe('PauseOverlaySpec', () => {
  it('mandates an opaque, blurring, challenge-hiding overlay with stable testID', () => {
    const spec = createPauseOverlaySpec('memory-sequence');
    expect(spec).toMatchObject({
      opaque: true,
      hidesChallenge: true,
      strongBlur: true,
    });
    expect(spec.accessibilityLabel).toContain('Paused');
    expect(spec.testID).toBe('memory-sequence.pause-overlay');
  });
});
