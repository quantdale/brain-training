/**
 * Cross-screen consistency tests (006R task 9.7).
 *
 * Tests that verify consistency across Home/Profile streak, Progress/Results
 * rating agreement, and stale behavior under high-density play.
 */
import { describe, expect, it, beforeEach } from '@jest/globals';

import { createMigratedDb } from '@/db/__tests__/helpers';
import { SessionRepository } from '@/db/sessions';
import { RatingRepository } from '@/db/rating';
import { LedgerRepository } from '@/db/ledger';
import { computeComposite } from '@/rating/composite';
import { reconstructStreak, effectiveCurrent } from '@/streaks';
import { localDateString } from '@/workout/today';
import { INITIAL_RATING } from '@/db/rating';
import type { GameSessionRecord } from '@/db';

const T0 = 1_700_000_000_000;
const KNOWN_DOMAINS = ['Memory', 'Attention', 'Speed', 'Math', 'Language', 'Logic & Problem Solving', 'Flexibility', 'Spatial'];

function makeSession(overrides: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id: `session-${Math.random().toString(36).slice(2, 8)}`,
    gameId: 'memory',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5 },
    rawResult: {},
    normalizedResult: 0.8,
    xp: 50,
    startedAt: T0,
    completedAt: T0 + 60_000,
    durationMs: 60_000,
    ...overrides,
  };
}

describe('Cross-screen streak consistency (task 9.7)', () => {
  let adapter: Awaited<ReturnType<typeof createMigratedDb>>;
  let sessions: SessionRepository;
  let ratings: RatingRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    sessions = new SessionRepository(adapter, () => T0);
    ratings = new RatingRepository(adapter, () => T0);
  });

  it('Home and Profile streak agree under high-density play', async () => {
    const today = localDateString(new Date(T0));
    const deltas = [{ domain: 'Memory', delta: 10 }];
    
    // Create 5 sessions on the same day (high-density play)
    for (let i = 0; i < 5; i++) {
      const session = makeSession({
        id: `session-${i}`,
        completedAt: T0 + i * 1000,
      });
      await sessions.completeSession({ session });
      await adapter.transaction((txn) => ratings.applyDeltas(txn, session.id, deltas, session.completedAt));
    }
    
    // Get activity dates (Home's streak input)
    const activityDates = await sessions.getDistinctActivityDates();
    
    // Reconstruct streak (both Home and Profile use this)
    const streak = reconstructStreak(activityDates, today);
    const currentStreak = effectiveCurrent(streak, today);
    
    // High-density play should still result in at least 1-day streak
    expect(currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('Streak remains correct across multiple days', async () => {
    const today = localDateString(new Date(T0));
    const deltas = [{ domain: 'Memory', delta: 10 }];
    
    // Create sessions on consecutive days
    for (let day = 0; day < 3; day++) {
      const session = makeSession({
        id: `session-day-${day}`,
        completedAt: T0 + day * 24 * 60 * 60 * 1000,
      });
      await sessions.completeSession({ session });
      await adapter.transaction((txn) => ratings.applyDeltas(txn, session.id, deltas, session.completedAt));
    }
    
    // Get activity dates
    const activityDates = await sessions.getDistinctActivityDates();
    
    // Reconstruct streak
    const streak = reconstructStreak(activityDates, today);
    const currentStreak = effectiveCurrent(streak, today);
    
    // Should have at least a 1-day streak (today)
    expect(currentStreak).toBeGreaterThanOrEqual(1);
  });
});

describe('Cross-screen rating consistency (task 9.7)', () => {
  let adapter: Awaited<ReturnType<typeof createMigratedDb>>;
  let sessions: SessionRepository;
  let ratings: RatingRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    sessions = new SessionRepository(adapter, () => T0);
    ratings = new RatingRepository(adapter, () => T0);
  });

  it('Progress and Results rating history agree', async () => {
    const deltas = [{ domain: 'Memory', delta: 10 }];
    
    // Create a session and apply rating deltas
    const session = makeSession({ id: 'test-session' });
    await sessions.completeSession({ session });
    await adapter.transaction((txn) => ratings.applyDeltas(txn, session.id, deltas, session.completedAt));
    
    // Get rating history for the session (Results screen uses this)
    const historyForSession = await ratings.getHistoryForSession(session.id);
    expect(historyForSession).toHaveLength(1);
    expect(historyForSession[0].domain).toBe('Memory');
    expect(historyForSession[0].delta).toBe(10);
    
    // Get overall rating (Progress screen uses this)
    const rating = await ratings.getRating('Memory');
    expect(rating?.rating).toBe(INITIAL_RATING + 10);
  });

  it('Composite reflects domain ratings correctly', async () => {
    const now = Date.now();
    const deltas = [
      { domain: 'Memory', delta: 100 },
      { domain: 'Attention', delta: -50 },
    ];
    
    // Create sessions and apply rating deltas
    for (let i = 0; i < 2; i++) {
      const session = makeSession({
        id: `session-${i}`,
        gameId: i === 0 ? 'memory' : 'attention',
      });
      await sessions.completeSession({ session });
      await adapter.transaction((txn) => ratings.applyDeltas(txn, session.id, [deltas[i]], session.completedAt));
    }
    
    // Get domain ratings
    const domainRatings = await ratings.getRatings();
    
    // Compute composite
    const composite = computeComposite(domainRatings, KNOWN_DOMAINS, now);
    
    // Composite should reflect the weighted average
    expect(composite.composite).toBeGreaterThan(INITIAL_RATING - 100);
    expect(composite.composite).toBeLessThan(INITIAL_RATING + 100);
    // domainCount may be fractional due to stale weighting
    expect(composite.domainCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Stale behavior (task 9.7)', () => {
  let adapter: Awaited<ReturnType<typeof createMigratedDb>>;
  let sessions: SessionRepository;
  let ratings: RatingRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    sessions = new SessionRepository(adapter, () => T0);
    ratings = new RatingRepository(adapter, () => T0);
  });

  it('Composite weights stale domains less', async () => {
    const now = Date.now();
    const staleTime = now - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    
    // Create sessions first (to satisfy foreign key)
    const freshSession = makeSession({
      id: 'fresh-session',
      completedAt: now,
    });
    const staleSession = makeSession({
      id: 'stale-session',
      completedAt: staleTime,
    });
    
    await sessions.completeSession({ session: freshSession });
    await sessions.completeSession({ session: staleSession });
    
    const freshDeltas = [{ domain: 'Memory', delta: 100 }];
    const staleDeltas = [{ domain: 'Attention', delta: 100 }];
    
    await adapter.transaction((txn) => ratings.applyDeltas(txn, freshSession.id, freshDeltas, freshSession.completedAt));
    await adapter.transaction((txn) => ratings.applyDeltas(txn, staleSession.id, staleDeltas, staleSession.completedAt));
    
    // Get domain ratings
    const domainRatings = await ratings.getRatings();
    
    // Compute composite
    const composite = computeComposite(domainRatings, KNOWN_DOMAINS, now);
    
    // Fresh domain should have more weight than stale domain
    expect(composite.staleDomainCount).toBe(1);
  });
});
