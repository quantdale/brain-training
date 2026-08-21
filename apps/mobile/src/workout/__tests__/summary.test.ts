/**
 * `buildWorkoutSummary` — pure completion-summary coverage (campaign 011 W07).
 *
 * The db-backed integration suite (db/__tests__/workout-v2.test.ts) exercises
 * summaries through REAL session rows; this file pins the pure matching rules
 * exhaustively: position matching, most-recent-since-creation, index-drift
 * clamping, template-key date parsing and reasons passthrough.
 */
import { describe, expect, it } from '@jest/globals';

import type { WorkoutInstance } from '@/db';
import {
  buildWorkoutSummary,
  type WorkoutSessionRef,
} from '@/workout/summary';
import type { WorkoutSelectionReason } from '@/workout/personalize';
import type { WorkoutMetadata } from '@/workout/metadata';

function makeInstance(overrides: Partial<WorkoutInstance> = {}): WorkoutInstance {
  return {
    date: '2026-08-21',
    gameIds: ['a', 'b', 'c'],
    status: 'active',
    currentIndex: 2,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 1_000,
    updatedAt: 5_000,
    ...overrides,
  };
}

function session(overrides: Partial<WorkoutSessionRef> = {}): WorkoutSessionRef {
  return {
    gameId: 'a',
    normalizedResult: 0.5,
    xp: 10,
    durationMs: 60_000,
    completedAt: 2_000,
    ...overrides,
  };
}

const metadata: WorkoutMetadata = {
  version: 1,
  kind: 'template',
  templateId: 'focus-memory',
  length: 'standard',
  focus: 'Memory',
};

describe('buildWorkoutSummary — matching rules', () => {
  it('marks positions below currentIndex played and matches their latest session', () => {
    const summary = buildWorkoutSummary(
      makeInstance(),
      [
        session({ gameId: 'a', completedAt: 2_000, xp: 4 }),
        session({ gameId: 'a', completedAt: 3_000, xp: 6 }), // most recent wins
        session({ gameId: 'c', completedAt: 9_000 }), // unplayed position: ignored
      ],
    );
    expect(summary.completedGames).toBe(2);
    expect(summary.outcomes[0]).toMatchObject({
      gameId: 'a',
      position: 0,
      played: true,
    });
    expect(summary.outcomes[0].session?.completedAt).toBe(3_000);
    expect(summary.outcomes[1].played).toBe(true);
    expect(summary.outcomes[1].session).toBeNull(); // no b-session at all
    expect(summary.outcomes[2]).toMatchObject({
      gameId: 'c',
      played: false,
      session: null,
    });
  });

  it('never matches sessions finished before the instance existed', () => {
    const summary = buildWorkoutSummary(
      makeInstance(),
      [session({ gameId: 'a', completedAt: 999 })], // pre-creation
    );
    expect(summary.outcomes[0].session).toBeNull();
    expect(summary.totalXp).toBe(0);
    expect(summary.finishedAt).toBeNull();
  });

  it('accepts a session finished exactly at creation time (>= boundary)', () => {
    const summary = buildWorkoutSummary(
      makeInstance(),
      [session({ gameId: 'a', completedAt: 1_000 })],
    );
    expect(summary.outcomes[0].session?.completedAt).toBe(1_000);
  });

  it('aggregates totals over matched sessions only (xp/duration/avg/finishedAt)', () => {
    const summary = buildWorkoutSummary(
      makeInstance({ gameIds: ['a', 'b'], currentIndex: 2, status: 'completed' }),
      [
        session({ gameId: 'a', xp: 7, normalizedResult: 0.2, durationMs: 10_000, completedAt: 2_000 }),
        session({ gameId: 'b', xp: 3, normalizedResult: 0.8, durationMs: 30_000, completedAt: 4_000 }),
        session({ gameId: 'zzz', xp: 100, durationMs: 999_999, completedAt: 9_000 }),
      ],
    );
    expect(summary.totalXp).toBe(10);
    expect(summary.totalDurationMs).toBe(40_000);
    expect(summary.avgNormalized).toBeCloseTo(0.5);
    expect(summary.finishedAt).toBe(4_000); // max of matched, not the foreign 9_000
    expect(summary.status).toBe('completed');
    expect(summary.completionRatio).toBe(1);
  });

  it('clamps a drifted persisted index in every direction (corrupt row)', () => {
    const negative = buildWorkoutSummary(makeInstance({ currentIndex: -3 }));
    expect(negative.completedGames).toBe(0);
    expect(negative.completionRatio).toBe(0);
    expect(negative.avgNormalized).toBeNull();

    const overflowing = buildWorkoutSummary(
      makeInstance({ currentIndex: 99 }),
    );
    expect(overflowing.completedGames).toBe(3);
    expect(overflowing.completionRatio).toBe(1);

    const fractional = buildWorkoutSummary(
      makeInstance({ currentIndex: 1.9 }),
    );
    expect(fractional.completedGames).toBe(1); // truncates onto a real slot
  });

  it('reports an empty workout with ratio 0 and null aggregates (no NaN)', () => {
    const summary = buildWorkoutSummary(makeInstance({ gameIds: [], currentIndex: 0 }));
    expect(summary.totalGames).toBe(0);
    expect(summary.completedGames).toBe(0);
    expect(summary.completionRatio).toBe(0);
    expect(summary.avgNormalized).toBeNull();
    expect(summary.finishedAt).toBeNull();
    expect(summary.outcomes).toEqual([]);
  });

  it('derives the calendar date from namespaced template keys and passes metadata through', () => {
    const summary = buildWorkoutSummary(
      makeInstance({
        date: '2026-08-21::focus-memory::extended',
        metadata,
      }),
      [],
    );
    expect(summary.key).toBe('2026-08-21::focus-memory::extended');
    expect(summary.date).toBe('2026-08-21');
    expect(summary.metadata).toEqual(metadata);
  });

  it('copies caller-supplied reasons without aliasing the input array', () => {
    const reasons: WorkoutSelectionReason[] = [
      { gameId: 'a', kind: 'weak-domain', detail: 'weak Memory domain' },
    ];
    const summary = buildWorkoutSummary(makeInstance(), [], reasons);
    expect(summary.reasons).toEqual(reasons);
    expect(summary.reasons).not.toBe(reasons);
  });
});
