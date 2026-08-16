// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import { loadContentPack } from '../content-validation';
import {
  buildLanguageRawResult,
  buildSessionRecord,
  persistLanguageSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { LANGUAGE_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeLanguageResult } from '../scoring';
import type { LanguageRawResult, LanguageStats } from '../types';

const STATS: LanguageStats = {
  score: 800,
  roundsPlayed: 6,
  roundsCorrect: 5,
  bestStreak: 4,
  streak: 0,
  totalAnswerMs: 21_000,
  sumAnswerRatio: 2.5,
};

function buildRaw(overrides: Partial<Parameters<typeof buildLanguageRawResult>[0]> = {}): LanguageRawResult {
  return buildLanguageRawResult({
    gameVersion: '1.0.0',
    generatorVersion: null,
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: LANGUAGE_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: '42',
    stats: STATS,
    outcomes: ['correct', 'correct', 'wrong', 'correct', 'correct', 'timeout'],
    finalTier: null,
    forced: false,
    startedAtMs: 1_000,
    activeDurationMs: 45_000,
    pausedDurationMs: 5_000,
    ...overrides,
  });
}

describe('seedToNumber', () => {
  it('keeps pure-numeric seeds verbatim', () => {
    expect(seedToNumber('42')).toBe(42);
    expect(seedToNumber('0')).toBe(0);
    expect(seedToNumber('4294967295')).toBe(4294967295);
  });

  it('hashes arbitrary seed strings deterministically', () => {
    expect(seedToNumber('my-seed')).toBe(seedToNumber('my-seed'));
    expect(seedToNumber('my-seed')).toBeGreaterThanOrEqual(0);
    expect(seedToNumber('my-seed')).toBeLessThanOrEqual(0xffffffff);
    expect(seedToNumber('my-seed')).not.toBe(seedToNumber('my-seed-2'));
  });
});

describe('buildLanguageRawResult', () => {
  it('carries the full reproducibility envelope including the content pack', () => {
    const pack = loadContentPack();
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBeNull();
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(5 / 6);
    expect(raw.roundOutcomes).toEqual(['correct', 'correct', 'wrong', 'correct', 'correct', 'timeout']);
    expect(raw.finalTier).toBeNull();
    expect(raw.contentPackId).toBe(pack.packId);
    expect(raw.contentPackVersion).toBe(pack.packVersion);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        packId: pack.packId,
        packVersion: pack.packVersion,
        rounds: 6,
        tierMask: 3,
        timePerRoundMs: 8000,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'language-word-match',
        seed: '42',
        difficulty: 'normal',
        startedAtMs: 1_000,
        activeDurationMs: 45_000,
        pausedDurationMs: 5_000,
      }),
    );
  });

  it('records the adaptive final tier', () => {
    const raw = buildRaw({ finalTier: 't2' });
    expect(raw.finalTier).toBe('t2');
  });

  it('reflects the stats', () => {
    const raw = buildRaw();
    expect(raw.score).toBe(800);
    expect(raw.roundsPlayed).toBe(6);
    expect(raw.roundsCorrect).toBe(5);
    expect(raw.bestStreak).toBe(4);
    expect(raw.totalAnswerMs).toBe(21_000);
    expect(raw.sumAnswerRatio).toBe(2.5);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape (non-procedural → 0 versions)', () => {
    const raw = buildRaw();
    const normalized = normalizeLanguageResult(raw, {
      gameId: 'language-word-match',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'language-x1',
      rawResult: raw,
      difficulty: { level: 'normal', challengeRating: 0.5, parameters: { ...LANGUAGE_DIFFICULTY_PARAMS.normal } },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'language-x1',
      gameId: 'language-word-match',
      gameVersion: 1,
      generatorVersion: 0, // generatorVersion null → 0
      scoringVersion: 1,
      seed: 42,
      difficulty: expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
      rawResult: raw,
      normalizedResult: normalized.value,
      xp: 0,
      startedAt: 1_000,
      completedAt: 46_001,
      durationMs: 45_000,
    });
  });

  it('records the diagnostic metadata through createDiagnosticMetadata', () => {
    const raw = buildRaw();
    const metadata = createDiagnosticMetadata({
      gameId: 'language-word-match',
      gameVersion: raw.gameVersion,
      generatorVersion: raw.generatorVersion,
      seed: raw.seed,
      difficulty: raw.difficulty,
      startedAtMs: raw.diagnosticMetadata.startedAtMs,
      activeDurationMs: raw.diagnosticMetadata.activeDurationMs,
      pausedDurationMs: raw.diagnosticMetadata.pausedDurationMs,
    });
    expect(metadata.sdkVersion).toBe('0.1.0');
    expect(metadata.generatorVersion).toBeNull();
  });
});

describe('persistLanguageSession', () => {
  const record: GameSessionRecord = {
    id: 'language-p1',
    gameId: 'language-word-match',
    gameVersion: 1,
    generatorVersion: 0,
    scoringVersion: 1,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5, parameters: {} },
    rawResult: buildRaw(),
    normalizedResult: 0.8,
    xp: 0,
    startedAt: 1_000,
    completedAt: 46_001,
    durationMs: 45_000,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists through the injected persister and reports the result', async () => {
    const completeSession = jest.fn(async () => ({
      session: record,
      ledgerEntry: null,
      balance: 0,
      rating: null,
    }));
    const persister: SessionPersistence = { completeSession };
    const outcome = await persistLanguageSession(record, persister);
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith({ session: record });
    if (outcome.ok) {
      expect(outcome.result.balance).toBe(0);
      expect(outcome.result.ledgerEntry).toBeNull();
    }
  });

  it('logs and returns failure instead of throwing when the db fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const persister: SessionPersistence = {
      completeSession: async () => {
        throw new Error('disk full');
      },
    };
    const outcome = await persistLanguageSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[language-word-match] failed to persist completed session language-p1',
      expect.any(Error),
    );
  });
});
