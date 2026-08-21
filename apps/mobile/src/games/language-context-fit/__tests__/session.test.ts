import { describe, expect, it, jest } from '@jest/globals';

import type { CompleteSessionInput, GameSessionRecord } from '@/db';
import type { DifficultyProfile } from '@/sdk';

import { loadContentPack } from '../content-validation';
import {
  buildContextFitRawResult,
  buildSessionRecord,
  persistContextFitSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { contextFitParamsForLevel } from '../difficulty';
import { createInitialContextFitState } from '../reducer';

function makePersister(ok: boolean): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) =>
    ok
      ? { session: input.session, ledgerEntry: null, balance: 0 }
      : Promise.reject(new Error('boom')),
  );
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

const PROFILE: DifficultyProfile = { level: 'normal', challengeRating: 0.5, parameters: { ...contextFitParamsForLevel('normal') } };

describe('session building', () => {
  it('buildContextFitRawResult carries the full reproducibility envelope', () => {
    const raw = buildContextFitRawResult({
      gameVersion: '1.0.0',
      generatorVersion: null,
      scoringVersion: '1.1.0',
      difficulty: 'normal',
      params: contextFitParamsForLevel('normal'),
      challengeRating: 0.5,
      seed: 'sess-seed',
      stats: createInitialContextFitState().stats,
      outcomes: ['correct', 'wrong'],
      finalTier: 't2',
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    expect(raw.seed).toBe('sess-seed');
    expect(raw.contentPackId).toBe(loadContentPack().packId);
    expect(raw.roundOutcomes).toEqual(['correct', 'wrong']);
    expect(raw.generatorInfo.rngAlgorithm).toBeDefined();
    expect(raw.diagnosticMetadata).toBeDefined();
  });

  it('buildSessionRecord maps to the persistence record shape', () => {
    const raw = buildContextFitRawResult({
      gameVersion: '1.0.0',
      generatorVersion: null,
      scoringVersion: '1.1.0',
      difficulty: 'normal',
      params: contextFitParamsForLevel('normal'),
      challengeRating: 0.5,
      seed: 'rec-seed',
      stats: createInitialContextFitState().stats,
      outcomes: [],
      finalTier: 't2',
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'id-1',
      rawResult: raw,
      difficulty: PROFILE,
      normalized: { value: 0.5, scale: '0..1' },
      xp: 10,
      startedAtMs: 0,
      completedAtMs: 100,
      activeDurationMs: 100,
    });
    expect(record.id).toBe('id-1');
    expect(record.gameId).toBe('language-context-fit');
    expect(record.xp).toBe(10);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.seed).toBe(seedToNumber('rec-seed'));
  });

  it('seedToNumber passes numeric seeds through and hashes non-numeric', () => {
    expect(seedToNumber('123')).toBe(123);
    expect(seedToNumber('not-a-number')).not.toBeNaN();
    expect(seedToNumber('not-a-number')).toBeGreaterThanOrEqual(0);
  });

  it('persistContextFitSession reports success and failure', async () => {
    const ok = makePersister(true);
    const fail = makePersister(false);
    const raw = buildContextFitRawResult({
      gameVersion: '1.0.0',
      generatorVersion: null,
      scoringVersion: '1.1.0',
      difficulty: 'normal',
      params: contextFitParamsForLevel('normal'),
      challengeRating: 0.5,
      seed: 'p',
      stats: createInitialContextFitState().stats,
      outcomes: [],
      finalTier: 't2',
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    const record = buildSessionRecord({
      sessionId: 'id-2',
      rawResult: raw,
      difficulty: PROFILE,
      normalized: { value: 0.5, scale: '0..1' },
      xp: 10,
      startedAtMs: 0,
      completedAtMs: 100,
      activeDurationMs: 100,
    });
    const okRes = await persistContextFitSession(record, ok);
    expect(okRes.ok).toBe(true);
    const failRes = await persistContextFitSession(record, fail);
    expect(failRes.ok).toBe(false);
  });
});
