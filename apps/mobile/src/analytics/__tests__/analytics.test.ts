import { describe, expect, it } from '@jest/globals';

import type { DomainRating, GameSessionRecord, RatingHistoryEntry } from '@/db';

import {
  buildActivityCalendar,
  buildDomainInsights,
  buildGameInsight,
  buildTrainingBalance,
  compareRecentVsLifetime,
  daysSinceLastSession,
  explainComposite,
  explainMetric,
  extractAccuracy,
  extractDifficultyRating,
  extractReactionMs,
  extractScore,
  filterByWindow,
  windowStartMs,
} from '@/analytics';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 20); // 2026-01-20, fixed for determinism

function domainRating(over: Partial<DomainRating>): DomainRating {
  return { domain: 'X', rating: 1000, sessions: 1, updatedAt: T0, ...over };
}

function history(over: Partial<RatingHistoryEntry>): RatingHistoryEntry {
  return {
    id: 1,
    sessionId: 's',
    domain: 'X',
    delta: 0,
    ratingAfter: 1000,
    createdAt: T0,
    ...over,
  };
}

function session(over: Partial<GameSessionRecord>): GameSessionRecord {
  return {
    id: 's',
    gameId: 'g',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.5,
    xp: 10,
    startedAt: T0,
    completedAt: T0,
    durationMs: 1000,
    ...over,
  };
}

describe('windows', () => {
  it('returns -Infinity for all-time and a bounded start otherwise', () => {
    expect(windowStartMs(T0, 'all')).toBe(-Infinity);
    expect(windowStartMs(T0, '7d')).toBe(T0 - 7 * DAY);
    expect(windowStartMs(T0, '30d')).toBe(T0 - 30 * DAY);
  });

  it('filters sessions by window inclusively', () => {
    const items = [
      session({ id: 'old', completedAt: T0 - 40 * DAY }),
      session({ id: 'mid', completedAt: T0 - 10 * DAY }),
      session({ id: 'now', completedAt: T0 }),
    ];
    const within30 = filterByWindow(items, T0, '30d');
    expect(within30.map((s) => s.id)).toEqual(['mid', 'now']);
    const all = filterByWindow(items, T0, 'all');
    expect(all).toHaveLength(3);
  });
});

describe('metrics-map extraction', () => {
  it('extracts score / accuracy / reaction from known field names', () => {
    const raw = {
      score: 120,
      accuracy: 0.85,
      avgResponseMs: 420,
      fastestReactionMs: 300,
    };
    expect(extractScore(raw)).toBe(120);
    expect(extractAccuracy(raw)).toBe(0.85);
    expect(extractReactionMs(raw)).toBe(420); // mean preferred over best
  });

  it('falls back to a best reaction field when no mean is present', () => {
    expect(extractReactionMs({ meanReactionMs: 250 })).toBe(250);
    expect(extractReactionMs({ fastestReactionMs: 180 })).toBe(180);
  });

  it('returns null for absent or malformed metrics (never fabricates)', () => {
    expect(extractScore({})).toBeNull();
    expect(extractScore({ score: 'nope' })).toBeNull();
    expect(extractAccuracy({ accuracy: 'high' })).toBeNull();
    expect(extractReactionMs({})).toBeNull();
  });

  it('clamps accuracy into [0,1]', () => {
    expect(extractAccuracy({ accuracy: 5 })).toBe(1);
    expect(extractAccuracy({ accuracy: -1 })).toBe(0);
  });

  it('reads challengeRating from difficulty then named levels', () => {
    expect(extractDifficultyRating({ challengeRating: 0.7 })).toBe(0.7);
    expect(extractDifficultyRating({ level: 'hard' })).toBe(0.8);
    expect(extractDifficultyRating('easy')).toBe(0.2);
    expect(extractDifficultyRating({ something: 1 })).toBeNull();
    expect(extractDifficultyRating('weird')).toBeNull();
  });
});

describe('buildDomainInsights', () => {
  const ratings: DomainRating[] = [
    domainRating({ domain: 'Memory', rating: 1020, sessions: 3, updatedAt: T0 - 10 * DAY }),
    domainRating({ domain: 'Speed', rating: 980, sessions: 1, updatedAt: T0 - 40 * DAY }),
  ];
  const known = ['Memory', 'Speed', 'Attention'];
  const ratingHistory: RatingHistoryEntry[] = [
    history({ id: 1, domain: 'Memory', ratingAfter: 1010, createdAt: T0 - 12 * DAY }),
    history({ id: 2, domain: 'Memory', ratingAfter: 1020, createdAt: T0 - 2 * DAY }),
    history({ id: 3, domain: 'Speed', ratingAfter: 980, createdAt: T0 - 40 * DAY }),
  ];

  it('classifies fresh / stale / unseen and orders by known domains', () => {
    const out = buildDomainInsights(ratings, known, ratingHistory, T0, '30d');
    expect(out.map((d) => d.domain)).toEqual(['Memory', 'Speed', 'Attention']);
    expect(out[0]).toMatchObject({ status: 'fresh', rating: 1020, sessions: 3, daysSinceUpdate: 10 });
    expect(out[1]).toMatchObject({ status: 'stale', rating: 980, daysSinceUpdate: 40 });
    expect(out[2]).toMatchObject({ status: 'unseen', rating: null, sessions: 0, daysSinceUpdate: null });
  });

  it('computes net movement inside the window from rating history', () => {
    const out = buildDomainInsights(ratings, known, ratingHistory, T0, '30d');
    const memory = out.find((d) => d.domain === 'Memory')!;
    // last (1020) - first (1010) in the 30d window = +10
    expect(memory.windowMovement).toBe(10);
    expect(memory.direction).toBe('up');
    expect(memory.windowEntries).toBe(2);

    const speed = out.find((d) => d.domain === 'Speed')!;
    // Speed's only history entry is 40d ago, outside the 30d window.
    expect(speed.windowEntries).toBe(0);
    expect(speed.windowMovement).toBe(0);
    expect(speed.direction).toBe('flat');
  });

  it('uses the full lifetime movement for the all-time window', () => {
    const out = buildDomainInsights(ratings, known, ratingHistory, T0, 'all');
    const memory = out.find((d) => d.domain === 'Memory')!;
    expect(memory.windowMovement).toBe(10);
    const speed = out.find((d) => d.domain === 'Speed')!;
    // All-time window includes the stale entry, so movement is observed.
    expect(speed.windowEntries).toBe(1);
    expect(speed.windowMovement).toBe(0); // single entry, last - first = 0
  });

  it('flags downward movement', () => {
    const downHistory = [
      history({ id: 1, domain: 'Memory', ratingAfter: 1030, createdAt: T0 - 12 * DAY }),
      history({ id: 2, domain: 'Memory', ratingAfter: 1000, createdAt: T0 - 2 * DAY }),
    ];
    const out = buildDomainInsights(
      [domainRating({ domain: 'Memory', rating: 1000, updatedAt: T0 - 2 * DAY })],
      ['Memory'],
      downHistory,
      T0,
      '30d',
    );
    expect(out[0].windowMovement).toBe(-30);
    expect(out[0].direction).toBe('down');
  });

  it('builds an in-window chronological series for sparklines', () => {
    const out = buildDomainInsights(ratings, known, ratingHistory, T0, '30d');
    const memory = out.find((d) => d.domain === 'Memory')!;
    // Both Memory entries are inside 30d; ascending by time.
    expect(memory.windowSeries).toEqual([
      { t: T0 - 12 * DAY, value: 1010 },
      { t: T0 - 2 * DAY, value: 1020 },
    ]);
    const speed = out.find((d) => d.domain === 'Speed')!;
    // Speed's only entry is outside the 30d window -> empty in-window series.
    expect(speed.windowSeries).toEqual([]);
  });

  it('derives the all-time personal best rating from stored evidence', () => {
    const peakHistory = [
      history({ id: 1, domain: 'Memory', ratingAfter: 1050, createdAt: T0 - 20 * DAY }),
      history({ id: 2, domain: 'Memory', ratingAfter: 1010, createdAt: T0 - 10 * DAY }),
      history({ id: 3, domain: 'Memory', ratingAfter: 1030, createdAt: T0 - 1 * DAY }),
    ];
    const out = buildDomainInsights(
      [domainRating({ domain: 'Memory', rating: 1030, updatedAt: T0 - 1 * DAY })],
      ['Memory'],
      peakHistory,
      T0,
      'all',
    );
    const memory = out[0];
    // Best ever was 1050 (20 days ago), even though current rating is lower.
    expect(memory.bestRating).toBe(1050);
    expect(memory.bestRatingAt).toBe(T0 - 20 * DAY);

    // Unseen domains have no personal best.
    const unseen = buildDomainInsights([], ['Attention'], [], T0, 'all');
    expect(unseen[0].bestRating).toBeNull();
    expect(unseen[0].bestRatingAt).toBeNull();
  });
});

describe('explainComposite (canonical calculation, no second score)', () => {
  const ratings: DomainRating[] = [
    domainRating({ domain: 'Memory', rating: 1020, sessions: 3, updatedAt: T0 - 10 * DAY }),
    domainRating({ domain: 'Speed', rating: 980, sessions: 1, updatedAt: T0 - 40 * DAY }),
  ];
  const known = ['Memory', 'Speed', 'Attention'];

  it('reuses computeComposite and breaks down weights transparently', () => {
    const exp = explainComposite(ratings, known, T0, 30);
    // 1020*1 + 980*0.5 + 1000*1 = 2510 over 2.5 weights -> 1004.
    expect(exp.composite).toBe(1004);
    expect(exp.seenDomains).toBe(2);
    expect(exp.unseenDomains).toBe(1);
    expect(exp.staleDomains).toBe(1);
    expect(exp.domains.map((d) => [d.domain, d.status, d.weight])).toEqual([
      ['Memory', 'fresh', 1],
      ['Speed', 'stale', 0.5],
      ['Attention', 'unseen', 1],
    ]);
  });

  it('treats every unseen domain at the initial rating', () => {
    const exp = explainComposite([], ['Memory', 'Speed', 'Attention'], T0, 30);
    expect(exp.composite).toBe(1000);
    expect(exp.seenDomains).toBe(0);
    expect(exp.unseenDomains).toBe(3);
  });
});

describe('buildActivityCalendar', () => {
  const sessions: GameSessionRecord[] = [
    session({ id: 'a', completedAt: T0 }), // today
    session({ id: 'b', completedAt: T0 - 1 * DAY }),
    session({ id: 'c', completedAt: T0 - 2 * DAY }),
    session({ id: 'd', completedAt: T0 - 2 * DAY }),
    session({ id: 'e', completedAt: T0 - 2 * DAY }),
    session({ id: 'f', completedAt: T0 - 5 * DAY }),
    session({ id: 'g', completedAt: T0 - 5 * DAY }),
  ];

  it('buckets sessions per UTC day and summarizes activity', () => {
    const cal = buildActivityCalendar(sessions, 10, T0);
    expect(cal.days).toHaveLength(10);
    expect(cal.totalSessions).toBe(7);
    expect(cal.activeDays).toBe(4); // days 0,1,2,5
    expect(cal.avgPerActiveDay).toBeCloseTo(7 / 4, 5);
    expect(cal.busiest?.count).toBe(3);
    expect(cal.busiest?.offsetDays).toBe(2);
    // Newest day is last with offset 0 and 1 session.
    expect(cal.days[cal.days.length - 1].offsetDays).toBe(0);
    expect(cal.days[cal.days.length - 1].count).toBe(1);
  });

  it('produces a contiguous grid including empty days', () => {
    const cal = buildActivityCalendar([session({ completedAt: T0 })], 5, T0);
    expect(cal.days).toHaveLength(5);
    expect(cal.days.filter((d) => d.hasSession)).toHaveLength(1);
    expect(cal.activeDays).toBe(1);
  });
});

describe('buildGameInsight', () => {
  const mk = (id: string, t: number, over: Partial<GameSessionRecord>): GameSessionRecord =>
    session({
      id,
      gameId: 'g-test',
      completedAt: t,
      durationMs: 30_000 - t, // monotonic: earlier = slower
      rawResult: { score: t, accuracy: 0.8, avgResponseMs: 500 - t / 10 },
      difficulty: { challengeRating: 0.5 + t / 10_000 },
      ...over,
    });

  const sessions: GameSessionRecord[] = [
    mk('s3', 3000, { normalizedResult: 0.8 }),
    mk('s1', 1000, { normalizedResult: 0.6 }),
    mk('s2', 2000, { normalizedResult: 0.7 }),
  ];

  it('returns null for no sessions', () => {
    expect(buildGameInsight('g', [])).toBeNull();
  });

  it('aggregates records and builds ascending trend series from stored evidence', () => {
    const insight = buildGameInsight('g-test', sessions)!;
    expect(insight.count).toBe(3);
    expect(insight.avgNormalized).toBeCloseTo(0.7, 5);
    expect(insight.bestNormalized).toBe(0.8);
    expect(insight.bestNormalizedSessionId).toBe('s3');
    // durationMs = 30000 - t, so s3 -> 27000, s1 -> 29000, s2 -> 28000.
    // fastest (min) = 27000 (s3).
    expect(insight.fastestMs).toBe(27_000);
    expect(insight.fastestMsSessionId).toBe('s3');

    expect(insight.available).toEqual({
      score: true,
      accuracy: true,
      reaction: true,
      difficulty: true,
    });
    expect(insight.bestScore).toBe(3000);
    expect(insight.bestAccuracy).toBe(0.8);
    expect(insight.bestReactionMs).toBe(200); // 500 - 3000

    // Series ordered ascending by completedAt.
    expect(insight.series.normalized.map((p) => p.value)).toEqual([0.6, 0.7, 0.8]);
    expect(insight.series.score.map((p) => p.t)).toEqual([1000, 2000, 3000]);
    expect(insight.series.difficulty.map((p) => p.value)).toEqual([0.5 + 0.1, 0.5 + 0.2, 0.5 + 0.3]);
  });

  it('omits a metric with no stored evidence', () => {
    const bare = session({
      id: 'x',
      gameId: 'g-bare',
      rawResult: {},
      difficulty: {},
      normalizedResult: 0.5,
    });
    const insight = buildGameInsight('g-bare', [bare])!;
    expect(insight.available).toEqual({
      score: false,
      accuracy: false,
      reaction: false,
      difficulty: false,
    });
    expect(insight.series.score).toHaveLength(0);
    expect(insight.bestScore).toBeNull();
  });

  it('computes recent form over the last five sessions', () => {
    // Sessions built oldest-first; s6 is the most recent.
    const many = [1, 2, 3, 4, 5, 6, 7].map((i) =>
      mk(`f${i}`, i * 1000, { normalizedResult: i / 10 }),
    );
    const insight = buildGameInsight('g-form', many)!;
    // Last five are f3..f7 -> (0.3+0.4+0.5+0.6+0.7)/5 = 0.5.
    expect(insight.recentFormCount).toBe(5);
    expect(insight.recentFormNormalized).toBeCloseTo(0.5, 5);

    // Fewer than five sessions: average over what exists.
    const few = buildGameInsight('g-few', sessions)!;
    expect(few.recentFormCount).toBe(3);
    expect(few.recentFormNormalized).toBeCloseTo(0.7, 5);
  });
});

describe('compareRecentVsLifetime', () => {
  const sessions: GameSessionRecord[] = [
    session({ id: 'a', completedAt: T0 - 40 * DAY, normalizedResult: 0.5, rawResult: { score: 100 } }),
    session({ id: 'b', completedAt: T0 - 5 * DAY, normalizedResult: 0.8, rawResult: { score: 200 } }),
    session({ id: 'c', completedAt: T0 - 1 * DAY, normalizedResult: 0.9, rawResult: { score: 250 } }),
  ];

  it('compares a recent window against the full lifetime', () => {
    const cmp = compareRecentVsLifetime(sessions, '30d', T0);
    // Recent (last 30d) = b, c. Lifetime = a, b, c.
    expect(cmp.recentCount).toBe(2);
    expect(cmp.lifetimeCount).toBe(3);
    expect(cmp.recentAvgNormalized).toBeCloseTo(0.85, 5);
    expect(cmp.lifetimeAvgNormalized).toBeCloseTo((0.5 + 0.8 + 0.9) / 3, 5);
    expect(cmp.deltaAvgNormalized).toBeCloseTo(0.85 - (0.5 + 0.8 + 0.9) / 3, 5);
    expect(cmp.recentBestScore).toBe(250);
    expect(cmp.lifetimeBestScore).toBe(250);
    expect(cmp.deltaBestScore).toBe(0);
  });

  it('reports nulls when the recent window is empty', () => {
    const cmp = compareRecentVsLifetime(
      [session({ completedAt: T0 - 40 * DAY, normalizedResult: 0.5 })],
      '7d',
      T0,
    );
    expect(cmp.recentCount).toBe(0);
    expect(cmp.recentAvgNormalized).toBeNull();
    expect(cmp.deltaAvgNormalized).toBeNull();
  });

  it('compares accuracy / reaction / difficulty only when persisted', () => {
    const withMetrics = [
      session({
        id: 'old',
        completedAt: T0 - 40 * DAY,
        normalizedResult: 0.5,
        rawResult: { accuracy: 0.6, avgResponseMs: 500 },
        difficulty: { challengeRating: 0.4 },
      }),
      session({
        id: 'new',
        completedAt: T0 - 1 * DAY,
        normalizedResult: 0.8,
        rawResult: { accuracy: 0.8, avgResponseMs: 400 },
        difficulty: { challengeRating: 0.6 },
      }),
    ];
    const cmp = compareRecentVsLifetime(withMetrics, '30d', T0);
    // Only the "new" session is inside the 30d window.
    expect(cmp.lifetimeAvgAccuracy).toBeCloseTo(0.7, 5);
    expect(cmp.recentAvgAccuracy).toBeCloseTo(0.8, 5);
    expect(cmp.deltaAvgAccuracy).toBeCloseTo(0.1, 5);
    expect(cmp.lifetimeAvgReactionMs).toBe(450);
    expect(cmp.recentAvgReactionMs).toBe(400);
    // Negative reaction delta = faster = improvement.
    expect(cmp.deltaAvgReactionMs).toBe(-50);
    expect(cmp.lifetimeAvgDifficulty).toBeCloseTo(0.5, 5);
    expect(cmp.deltaAvgDifficulty).toBeCloseTo(0.1, 5);
  });

  it('returns null metric comparisons when no session carries the metric', () => {
    const cmp = compareRecentVsLifetime(
      [
        session({ id: 'a', completedAt: T0 - 1 * DAY }),
        session({ id: 'b', completedAt: T0 - 2 * DAY }),
      ],
      '30d',
      T0,
    );
    expect(cmp.recentAvgAccuracy).toBeNull();
    expect(cmp.lifetimeAvgAccuracy).toBeNull();
    expect(cmp.deltaAvgAccuracy).toBeNull();
    expect(cmp.recentAvgReactionMs).toBeNull();
    expect(cmp.lifetimeAvgReactionMs).toBeNull();
    expect(cmp.deltaAvgReactionMs).toBeNull();
    expect(cmp.recentAvgDifficulty).toBeNull();
    expect(cmp.lifetimeAvgDifficulty).toBeNull();
    expect(cmp.deltaAvgDifficulty).toBeNull();
  });
});

describe('daysSinceLastSession', () => {
  it('counts whole days back from the most recent session', () => {
    const sessions = [
      session({ id: 'a', completedAt: T0 - 3 * DAY }),
      session({ id: 'b', completedAt: T0 - 10 * DAY }),
      session({ id: 'c', completedAt: T0 - 2 * DAY - 1000 }),
    ];
    // Most recent is 2 days + 1000ms ago -> floor = 2.
    expect(daysSinceLastSession(sessions, T0)).toBe(2);
    // A session today -> 0.
    expect(daysSinceLastSession([session({ completedAt: T0 })], T0)).toBe(0);
  });

  it('returns null when there are no sessions', () => {
    expect(daysSinceLastSession([], T0)).toBeNull();
  });
});

describe('buildTrainingBalance', () => {
  const known = ['Memory', 'Attention', 'Speed'] as const;
  const resolve = (gameId: string) =>
    ({ mem: 'Memory', att: 'Attention' })[gameId] ?? null;

  it('distributes window sessions across primary domains with shares', () => {
    const sessions = [
      session({ id: '1', gameId: 'mem', completedAt: T0 - 1 * DAY }),
      session({ id: '2', gameId: 'mem', completedAt: T0 - 2 * DAY }),
      session({ id: '3', gameId: 'att', completedAt: T0 - 3 * DAY }),
      // Outside the 7d window: must not count.
      session({ id: '4', gameId: 'mem', completedAt: T0 - 30 * DAY }),
    ];
    const balance = buildTrainingBalance(sessions, resolve, known, T0, '7d');
    expect(balance.windowSessions).toBe(3);
    expect(balance.mappedSessions).toBe(3);
    expect(balance.unmappedSessions).toBe(0);
    expect(balance.perDomain).toEqual([
      { domain: 'Memory', sessions: 2, share: 2 / 3 },
      { domain: 'Attention', sessions: 1, share: 1 / 3 },
      { domain: 'Speed', sessions: 0, share: 0 },
    ]);
    expect(balance.trainedDomains).toBe(2);
    expect(balance.untrainedDomains).toEqual(['Speed']);
    expect(balance.topDomain).toBe('Memory');
    expect(balance.topDomainShare).toBeCloseTo(2 / 3, 5);
  });

  it('reports unmapped sessions instead of dropping them silently', () => {
    const sessions = [
      session({ id: '1', gameId: 'unknown-game', completedAt: T0 - 1 * DAY }),
      session({ id: '2', gameId: 'mem', completedAt: T0 - 1 * DAY }),
    ];
    const balance = buildTrainingBalance(sessions, resolve, known, T0, '30d');
    expect(balance.windowSessions).toBe(2);
    expect(balance.mappedSessions).toBe(1);
    expect(balance.unmappedSessions).toBe(1);
    // Shares are relative to mapped sessions only.
    expect(balance.perDomain.find((d) => d.domain === 'Memory')!.share).toBe(1);
  });

  it('handles an empty window with explicit zero state', () => {
    const balance = buildTrainingBalance(
      [session({ completedAt: T0 - 400 * DAY })],
      resolve,
      known,
      T0,
      '30d',
    );
    expect(balance.windowSessions).toBe(0);
    expect(balance.topDomain).toBeNull();
    expect(balance.topDomainShare).toBeNull();
    expect(balance.untrainedDomains).toEqual([...known]);
    expect(balance.perDomain.every((d) => d.share === 0)).toBe(true);
  });
});

describe('explainMetric', () => {
  it('returns a fixed derivation sentence per metric key', () => {
    expect(explainMetric('composite')).toContain('average');
    expect(explainMetric('balance')).toContain('primary domain');
    expect(explainMetric('reaction')).toContain('lower is faster');
    // Deterministic: same key always yields the same sentence.
    expect(explainMetric('recency')).toBe(explainMetric('recency'));
  });
});
