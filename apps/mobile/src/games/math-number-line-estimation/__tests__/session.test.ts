// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';

import { NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import {
  buildNumberLineRawResult,
  buildSessionRecord,
  persistNumberLineSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { INITIAL_STATS } from '../types';
import type { NumberLineRawResult } from '../types';
import { versionToNumber } from '../versions';

const PARAMS = NUMBER_LINE_DIFFICULTY_PARAMS.normal;

function baseInput() {
  return {
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0' as string | null,
    scoringVersion: '1.0.0',
    difficulty: 'normal' as const,
    params: PARAMS,
    finalTolerancePct: PARAMS.tolerancePct,
    challengeRating: 0.5,
    seed: 'test-seed',
    stats: { ...INITIAL_STATS },
    forced: false,
    startedAtMs: 1000,
    activeDurationMs: 5000,
    pausedDurationMs: 250,
  };
}

describe('buildNumberLineRawResult', () => {
  it('carries stats plus the full reproducibility envelope', () => {
    const raw = buildNumberLineRawResult(baseInput());
    expect(raw.gameId).toBeUndefined(); // gameId lives on the record, not the raw result
    expect(raw.seed).toBe('test-seed');
    expect(raw.difficulty).toBe('normal');
    expect(raw.roundsTotal).toBe(PARAMS.rounds);
    expect(raw.finalTolerancePct).toBe(PARAMS.tolerancePct);
    expect(raw.generatorInfo.rngAlgorithm).toBeTruthy();
    expect(raw.diagnosticMetadata.gameId).toBe('math-number-line-estimation');
    expect(raw.diagnosticMetadata.activeDurationMs).toBe(5000);
  });

  it('derives meanCloseness and avgAbsoluteError from the stats with division guards', () => {
    const raw = buildNumberLineRawResult(
      baseInput(),
    );
    expect(raw.meanCloseness).toBe(0); // nothing played
    expect(raw.avgAbsoluteError).toBe(0);

    const played = buildNumberLineRawResult({
      ...baseInput(),
      stats: {
        ...INITIAL_STATS,
        roundsPlayed: 4,
        roundsHit: 2,
        totalCloseness: 2.4,
        totalAbsoluteError: 10,
      },
    });
    expect(played.meanCloseness).toBeCloseTo(0.6);
    expect(played.avgAbsoluteError).toBeCloseTo(2.5);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim and hashes strings deterministically', () => {
    expect(seedToNumber('42')).toBe(42);
    expect(seedToNumber('abc')).toBe(seedToNumber('abc'));
    expect(seedToNumber('abc')).not.toBe(seedToNumber('abd'));
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the db record shape', () => {
    const raw: NumberLineRawResult = buildNumberLineRawResult(baseInput());
    const normalized = { value: 0.75, scale: '0..1' as const };
    const record = buildSessionRecord({
      sessionId: 'sess-1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        parameters: numberLineParamsRecord(),
      },
      normalized,
      xp: 12,
      startedAtMs: 1000,
      completedAtMs: 6000,
      activeDurationMs: 5000,
    });
    expect(record.id).toBe('sess-1');
    expect(record.gameId).toBe('math-number-line-estimation');
    expect(record.gameVersion).toBe(versionToNumber('1.0.0'));
    expect(record.seed).toBe(seedToNumber('test-seed'));
    expect(record.normalizedResult).toBe(0.75);
    expect(record.xp).toBe(12);
    expect(record.durationMs).toBe(5000);
    expect((record.difficulty as { level: string }).level).toBe('normal');
  });

  function numberLineParamsRecord(): Record<string, number> {
    return {
      rounds: PARAMS.rounds,
      budgetMs: PARAMS.budgetMs,
      lineMin: PARAMS.lineMin,
      lineMax: PARAMS.lineMax,
      tolerancePct: PARAMS.tolerancePct,
    };
  }
});

describe('persistNumberLineSession', () => {
  function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
    const completeSession = jest.fn(async () => ({
      session: {} as never,
      ledgerEntry: null,
      balance: 0,
    }));
    return { completeSession } as unknown as SessionPersistence & { completeSession: jest.Mock };
  }

  it('returns ok with the completion result on success', async () => {
    const persister = makePersister();
    const outcome = await persistNumberLineSession({ id: 'x' } as never, persister);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.balance).toBe(0);
    }
  });

  it('never throws on persistence failure — returns ok:false instead', async () => {
    const failing: SessionPersistence = {
      completeSession: async () => {
        throw new Error('db locked');
      },
    };
    const outcome = await persistNumberLineSession({ id: 'x' } as never, failing);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(String(outcome.error)).toContain('db locked');
    }
  });
});
