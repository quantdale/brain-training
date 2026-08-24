import { describe, expect, it } from '@jest/globals';
import type { GameDefinition } from '@/sdk';

import { buildPersonalizationContext } from '../context';
import {
  formatNoveltyDetail,
  formatUndertrainedDetail,
} from '../explain';
import {
  FATIGUE_RECENT_SESSIONS,
  NOVELTY_MAX_SESSIONS,
} from '../signals';
import {
  rankRecommendations,
  scoreGame,
  selectRecommendations,
} from '../scoring';
import type { PersonalizationContext } from '../types';

function makeGame(
  id: string,
  primaryCategory: GameDefinition['primaryCategory'],
): GameDefinition {
  return {
    id,
    name: id,
    primaryCategory,
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: null,
    contentVersion: null,
    hasTutorial: false,
  };
}

const NOW_MS = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Evidence-free context: no ratings, no aggregates, no sessions. */
function emptyContext(nowMs?: number): PersonalizationContext {
  return buildPersonalizationContext({ nowMs });
}

describe('rankRecommendations determinism', () => {
  it('yields deep-equal output for identical inputs and injected clock', () => {
    const games = [
      makeGame('g-memory', 'Memory'),
      makeGame('g-attention', 'Attention'),
      makeGame('g-speed', 'Speed'),
    ];
    const args = {
      ratings: [
        { domain: 'Memory', rating: 850, sessions: 2, updatedAt: NOW_MS },
        { domain: 'Attention', rating: 1150, sessions: 9, updatedAt: NOW_MS - 40 * DAY_MS },
      ],
      aggregates: [
        { gameId: 'g-speed', count: 6, avgNormalized: 0.55, bestNormalized: 0.7, lastCompletedAt: NOW_MS },
      ],
      recentSessions: [
        { gameId: 'g-speed', normalizedResult: 0.62, completedAt: NOW_MS },
        { gameId: 'g-speed', normalizedResult: 0.58, completedAt: NOW_MS - DAY_MS },
        { gameId: 'g-speed', normalizedResult: 0.61, completedAt: NOW_MS - 2 * DAY_MS },
      ],
      nowMs: NOW_MS,
    };
    const a = rankRecommendations(games, buildPersonalizationContext(args));
    const b = rankRecommendations(games, buildPersonalizationContext(args));
    expect(a).toEqual(b);
  });
});

describe('weak-domain signal', () => {
  it('surfaces an actively declined domain above a strong one', () => {
    const weakGame = makeGame('g-weak', 'Memory');
    const strongGame = makeGame('g-strong', 'Attention');
    const context = buildPersonalizationContext({
      ratings: [
        { domain: 'Memory', rating: 800, sessions: 4, updatedAt: NOW_MS },
        { domain: 'Attention', rating: 1200, sessions: 4, updatedAt: NOW_MS },
      ],
      nowMs: NOW_MS,
    });
    const ranked = rankRecommendations([strongGame, weakGame], context);
    expect(ranked[0]?.game.id).toBe('g-weak');
    // 800 is a full WEAKNESS_FULL_AT_DROP below the threshold ⇒ saturated.
    expect(ranked[0]?.components.some((c) => c.key === 'weak-domain')).toBe(true);
    expect(
      ranked[1]?.components.some((c) => c.key === 'weak-domain'),
    ).toBe(false);
  });
});

describe('overexposure signal', () => {
  it('demotes a game that dominated the recent session window', () => {
    const fatigued = makeGame('g-fatigued', 'Memory');
    const fresh = makeGame('g-fresh', 'Math');
    // 8 of the last 10 overall sessions went to g-fatigued; g-fresh's 2 sit
    // inside the free allowance so only fatigue separates the two games.
    const recentSessions = [
      ...Array.from({ length: 8 }, (_, i) => ({
        gameId: 'g-fatigued',
        normalizedResult: 0.6,
        completedAt: NOW_MS - i * DAY_MS,
      })),
      { gameId: 'g-fresh', normalizedResult: 0.6, completedAt: NOW_MS - 8 * DAY_MS },
      { gameId: 'g-fresh', normalizedResult: 0.6, completedAt: NOW_MS - 9 * DAY_MS },
    ];
    const context = buildPersonalizationContext({
      ratings: [
        { domain: 'Memory', rating: 1100, sessions: 8, updatedAt: NOW_MS },
        { domain: 'Math', rating: 1100, sessions: 8, updatedAt: NOW_MS },
      ],
      aggregates: [
        { gameId: 'g-fatigued', count: 8, avgNormalized: 0.6, bestNormalized: 0.6, lastCompletedAt: NOW_MS },
        { gameId: 'g-fresh', count: 8, avgNormalized: 0.6, bestNormalized: 0.6, lastCompletedAt: NOW_MS },
      ],
      recentSessions,
      nowMs: NOW_MS,
    });
    const ranked = rankRecommendations([fatigued, fresh], context);
    expect(ranked[0]?.game.id).toBe('g-fresh');
    const dampener = ranked[1]?.components.find((c) => c.key === 'overexposure');
    expect(dampener).toBeDefined();
    expect(dampener?.weight).toBeLessThan(0);
    expect(dampener?.value).toBeCloseTo(6 / (FATIGUE_RECENT_SESSIONS - 2), 10);
    expect(ranked[1]?.score).toBeLessThan(ranked[0]?.score ?? Infinity);
  });
});

describe('novelty signal', () => {
  it('boosts never-played games and skips veterans', () => {
    const unseen = makeGame('g-unseen', 'Spatial');
    const veteran = makeGame('g-veteran', 'Logic & Problem Solving');
    const context = buildPersonalizationContext({
      aggregates: [
        {
          gameId: 'g-veteran',
          count: NOVELTY_MAX_SESSIONS + 2,
          avgNormalized: 0.5,
          bestNormalized: 0.5,
          lastCompletedAt: NOW_MS,
        },
      ],
      nowMs: NOW_MS,
    });
    const scoredUnseen = scoreGame(unseen, context);
    const novelty = scoredUnseen.components.find((c) => c.key === 'novelty');
    expect(novelty?.value).toBe(1);
    expect(novelty?.reason).toBe(formatNoveltyDetail(0));
    const scoredVeteran = scoreGame(veteran, context);
    expect(
      scoredVeteran.components.some((c) => c.key === 'novelty'),
    ).toBe(false);
  });
});

describe('stale-domain signal (opt-in clock)', () => {
  const rusty = makeGame('g-rusty', 'Speed');
  const ratings = [
    { domain: 'Speed', rating: 1300, sessions: 5, updatedAt: NOW_MS - 40 * DAY_MS },
  ];

  it('emits no stale component without an injected clock', () => {
    const scored = scoreGame(rusty, emptyContext());
    expect(
      scored.components.some((c) => c.key === 'stale-domain'),
    ).toBe(false);
  });

  it('emits a stale component once the clock is provided', () => {
    const context = buildPersonalizationContext({ ratings, nowMs: NOW_MS });
    const scored = scoreGame(rusty, context);
    const stale = scored.components.find((c) => c.key === 'stale-domain');
    expect(stale).toBeDefined();
    expect(stale?.value).toBeCloseTo((40 - 30) / 30, 10);
  });
});

describe('selectRecommendations composition fit', () => {
  it('spreads picks across categories and explains the penalty', () => {
    const pool = [
      makeGame('m1', 'Memory'),
      makeGame('m2', 'Memory'),
      makeGame('m3', 'Memory'),
      makeGame('m4', 'Memory'),
      makeGame('a1', 'Attention'),
    ];
    const picked = selectRecommendations(pool, emptyContext(NOW_MS), 4);
    expect(picked.map((p) => p.game.id)).toEqual(['m1', 'a1', 'm2', 'm3']);
    // First pick of a category carries no penalty; later repeats do.
    expect(
      picked[0]?.components.some((c) => c.key === 'composition-fit'),
    ).toBe(false);
    const repeatPenalty = picked
      .filter((p) => p.game.primaryCategory === 'Memory')
      .slice(1)
      .flatMap((p) => p.components.filter((c) => c.key === 'composition-fit'));
    expect(repeatPenalty.length).toBeGreaterThan(0);
    for (const component of repeatPenalty) {
      expect(component.contribution).toBeLessThan(0);
    }
  });
});

describe('scoring invariants', () => {
  it('keeps score as the exact sum of weight×value and score01 in [0,1]', () => {
    const games = [
      makeGame('g-a', 'Memory'),
      makeGame('g-b', 'Speed'),
      makeGame('g-c', 'Math'),
    ];
    const context = buildPersonalizationContext({
      ratings: [
        { domain: 'Memory', rating: 900, sessions: 1, updatedAt: NOW_MS - 90 * DAY_MS },
        { domain: 'Speed', rating: 1400, sessions: 12, updatedAt: NOW_MS },
      ],
      aggregates: [
        { gameId: 'g-c', count: 10, avgNormalized: 0.4, bestNormalized: 0.55, lastCompletedAt: NOW_MS },
      ],
      recentSessions: [
        { gameId: 'g-c', normalizedResult: 0.52, completedAt: NOW_MS },
        { gameId: 'g-c', normalizedResult: 0.5, completedAt: NOW_MS - DAY_MS },
        { gameId: 'g-c', normalizedResult: 0.54, completedAt: NOW_MS - 2 * DAY_MS },
      ],
      nowMs: NOW_MS,
    });
    for (const entry of rankRecommendations(games, context)) {
      let sum = 0;
      for (const component of entry.components) {
        expect(component.contribution).toBe(component.weight * component.value);
        expect(component.value).toBeGreaterThan(0);
        expect(component.value).toBeLessThanOrEqual(1);
        sum += component.contribution;
      }
      expect(entry.score).toBe(sum);
      expect(entry.score01).toBeGreaterThanOrEqual(0);
      expect(entry.score01).toBeLessThanOrEqual(1);
    }
  });
});

describe('new-player behavior (empty evidence)', () => {
  it('ranks nothing for an empty catalog and emits only prior-free boosts', () => {
    expect(rankRecommendations([], emptyContext())).toEqual([]);
    expect(selectRecommendations([], emptyContext(), 4)).toEqual([]);
    const scored = scoreGame(makeGame('g-x', 'Language'), emptyContext(NOW_MS));
    expect(scored.components.map((c) => c.key)).toEqual([
      'undertrained-domain',
      'novelty',
    ]);
    expect(scored.components[0]?.reason).toBe(formatUndertrainedDetail('Language', 0));
    expect(scored.components[1]?.value).toBe(1);
  });
});
