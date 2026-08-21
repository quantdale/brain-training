import { describe, expect, it } from '@jest/globals';

import { buildAssistantContextSummary } from '../context';
import {
  ASSISTANT_CONTEXT_VERSION,
  RECENT_SESSION_LIMIT,
  TOP_GAME_LIMIT,
} from '../types';

const NOW_MS = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('buildAssistantContextSummary determinism', () => {
  it('yields deep-equal summaries for identical inputs and injected clock', () => {
    const args = {
      ratings: [
        { domain: 'Memory', rating: 1100, sessions: 5, updatedAt: NOW_MS },
        { domain: 'Attention', rating: 900, sessions: 2, updatedAt: NOW_MS - DAY_MS },
      ],
      aggregates: [
        { gameId: 'g-a', count: 4, avgNormalized: 0.6, bestNormalized: 0.8, lastCompletedAt: NOW_MS },
        { gameId: 'g-b', count: 9, avgNormalized: 0.5, bestNormalized: 0.7, lastCompletedAt: NOW_MS - DAY_MS },
      ],
      recentSessions: [
        { gameId: 'g-b', normalizedResult: 0.55, completedAt: NOW_MS },
      ],
      totalXp: 750,
      coinBalance: 120,
      streak: { current: 6, longest: 11, lastActiveDate: '2026-08-20', atRisk: false },
      nowMs: NOW_MS,
    };
    const a = buildAssistantContextSummary(args);
    const b = buildAssistantContextSummary(args);
    expect(a).toEqual(b);
    expect(a.advisoryOnly).toBe(true);
    expect(a.contextVersion).toBe(ASSISTANT_CONTEXT_VERSION);
    expect(a.generatedAtMs).toBe(NOW_MS);
  });
});

describe('summary ordering and derivation', () => {
  it('orders domains weakest-first with name tiebreak and flags staleness only with a clock', () => {
    const summary = buildAssistantContextSummary({
      ratings: [
        { domain: 'Speed', rating: 1000, sessions: 1, updatedAt: NOW_MS },
        { domain: 'Memory', rating: 900, sessions: 3, updatedAt: NOW_MS - 40 * DAY_MS },
        { domain: 'Attention', rating: 900, sessions: 2, updatedAt: NOW_MS },
      ],
      nowMs: NOW_MS,
    });
    expect(summary.domains.map((d) => d.domain)).toEqual([
      'Attention',
      'Memory',
      'Speed',
    ]);
    expect(summary.domains[1].stale).toBe(true); // Memory: 40 days old
    expect(summary.domains[0].stale).toBe(false);
    // No clock → staleness unknown, never guessed.
    const timeless = buildAssistantContextSummary({
      ratings: [{ domain: 'Memory', rating: 900, updatedAt: NOW_MS }],
    });
    expect(timeless.generatedAtMs).toBeNull();
    expect(timeless.domains[0].stale).toBeNull();
  });

  it('derives level from the shared XP curve and caps capped lists deterministically', () => {
    const recentSessions = Array.from({ length: 25 }, (_, i) => ({
      gameId: `g-${i % 3}`,
      normalizedResult: 0.5,
      completedAt: NOW_MS - i * 1000,
    }));
    const summary = buildAssistantContextSummary({
      totalXp: 300, // levelForXp(300) === 3 (50*L*(L-1) curve)
      aggregates: [
        { gameId: 'g-x', count: 2, avgNormalized: 0.5, bestNormalized: 0.5, lastCompletedAt: NOW_MS },
        { gameId: 'g-z', count: 7, avgNormalized: 0.5, bestNormalized: 0.5, lastCompletedAt: NOW_MS },
        { gameId: 'g-y', count: 7, avgNormalized: 0.5, bestNormalized: 0.5, lastCompletedAt: NOW_MS + 1 },
        { gameId: 'g-w', count: 7, avgNormalized: 0.5, bestNormalized: 0.5, lastCompletedAt: NOW_MS + 2 },
      ],
      recentSessions,
    });
    expect(summary.profile.level).toBe(3);
    expect(summary.topGames.length).toBe(TOP_GAME_LIMIT);
    // count desc, then lastCompletedAt desc, then gameId asc.
    expect(summary.topGames.map((g) => g.gameId)).toEqual(['g-w', 'g-y', 'g-z']);
    expect(summary.recentSessions.length).toBe(RECENT_SESSION_LIMIT);
    expect(summary.recentSessions[0].completedAt).toBe(NOW_MS);
  });
});

describe('defensive sanitization', () => {
  it('drops corrupt rows and degrades corrupt scalars instead of throwing', () => {
    const summary = buildAssistantContextSummary({
      ratings: [
        { domain: '', rating: 900 },
        { domain: 'Memory', rating: Number.NaN },
        { domain: 'Logic & Problem Solving', rating: 1050, sessions: 4 },
      ] as never,
      aggregates: [
        { gameId: '', count: 1, avgNormalized: 0.5, bestNormalized: 0.5, lastCompletedAt: NOW_MS },
      ] as never,
      totalXp: Number.NaN,
      coinBalance: Number.NaN,
      streak: { current: Number.NaN, longest: -5, lastActiveDate: 42, atRisk: 1 } as never,
    });
    expect(summary.domains.map((d) => d.domain)).toEqual(['Logic & Problem Solving']);
    expect(summary.topGames).toEqual([]);
    expect(summary.profile.totalXp).toBe(0);
    expect(summary.profile.level).toBe(1);
    expect(summary.profile.coinBalance).toBeNull();
    expect(summary.streak).toBeNull();
    expect(summary.recentSessions).toEqual([]);
  });
});
