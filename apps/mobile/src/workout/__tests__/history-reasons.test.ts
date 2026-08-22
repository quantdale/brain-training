/**
 * Recorded-reasons provenance (campaign 012 W06, target 4).
 *
 * Reasons computed at selection time must survive restarts: they persist
 * inside versioned `metadata_json` and are surfaced back through history
 * summaries ONLY while they still describe the persisted selection
 * (`alignedRecordedReasons`). These pure tests pin the round-trip and the
 * defensive-degradation policy without a database.
 */
import { describe, expect, it } from '@jest/globals';

import {
  createWorkoutMetadata,
  parseWorkoutMetadata,
} from '@/workout/metadata';
import type { WorkoutMetadata } from '@/workout/metadata';
import { alignedRecordedReasons } from '@/workout/reasons';
import type { WorkoutSelectionReason } from '@/workout/personalize';

const REASONS: WorkoutSelectionReason[] = [
  { gameId: 'memory-prospective-cue', kind: 'weak-domain', detail: 'weak Memory domain (rating 900)' },
  { gameId: 'attention-focus-flow', kind: 'stale-domain', detail: 'rusty Attention domain (rating 1200, not played for ~40d)' },
  { gameId: 'speed-tap-rush', kind: 'recency-avoided', detail: 'recently played, lower priority' },
  { gameId: 'math-fast-math', kind: 'selected', detail: 'balanced selection' },
];

const METADATA: WorkoutMetadata = createWorkoutMetadata({
  kind: 'template',
  templateId: 'focus-memory',
  length: 'standard',
  focus: 'Memory',
  reasons: REASONS,
});

describe('reasons metadata round-trip', () => {
  it('omits the field entirely when no reasons were supplied', () => {
    const bare = createWorkoutMetadata({
      kind: 'daily',
      templateId: 'daily-mix',
      length: 'standard',
      focus: null,
    });
    expect('reasons' in bare).toBe(false);
    const parsed = parseWorkoutMetadata(JSON.parse(JSON.stringify(bare)));
    expect(parsed?.reasons).toBeUndefined();
  });

  it('round-trips a valid recorded array through parseWorkoutMetadata', () => {
    const parsed = parseWorkoutMetadata(JSON.parse(JSON.stringify(METADATA)));
    expect(parsed?.reasons).toEqual(REASONS);
    // Deep-copy, not aliasing: mutating the parsed copy cannot corrupt the
    // producer's array (and vice versa).
    expect(parsed?.reasons).not.toBe(REASONS);
  });

  it('drops the WHOLE array when any entry is malformed', () => {
    const notArray = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: 'nope',
    });
    expect(notArray?.reasons).toBeUndefined();

    const badKind = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: [...REASONS, { gameId: 'x', kind: 'vibes', detail: 'd' }],
    });
    expect(badKind?.reasons).toBeUndefined();

    const missingGameId = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: [{ kind: 'selected', detail: 'balanced selection' }],
    });
    expect(missingGameId?.reasons).toBeUndefined();

    const nonStringDetail = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: [{ gameId: 'a', kind: 'selected', detail: 7 }],
    });
    expect(nonStringDetail?.reasons).toBeUndefined();

    const nonObjectEntry = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: ['memory-prospective-cue'],
    });
    expect(nonObjectEntry?.reasons).toBeUndefined();
  });

  it('accepts an empty recorded array as a valid (empty) record', () => {
    const parsed = parseWorkoutMetadata({
      ...JSON.parse(JSON.stringify(METADATA)),
      reasons: [],
    });
    expect(parsed?.reasons).toEqual([]);
  });
});

describe('alignedRecordedReasons (provenance validity gate)', () => {
  it('returns null when there is nothing recorded', () => {
    expect(alignedRecordedReasons(['a'], undefined)).toBeNull();
    expect(
      alignedRecordedReasons(['a'], createWorkoutMetadata({
        kind: 'daily',
        templateId: 'daily-mix',
        length: 'standard',
        focus: null,
      })),
    ).toBeNull();
  });

  it('returns null on length or order drift (reroll / reconcile aftermath)', () => {
    expect(alignedRecordedReasons(['a', 'b'], METADATA)).toBeNull(); // length
    const reordered = [
      REASONS[1],
      REASONS[0],
      REASONS[2],
      REASONS[3],
    ] as WorkoutSelectionReason[];
    expect(
      alignedRecordedReasons(
        reordered.map((r) => r.gameId),
        { ...METADATA, reasons: REASONS },
      ),
    ).toBeNull(); // order mismatch vs recorded
  });

  it('returns a copy of the recorded reasons when fully aligned', () => {
    const ids = REASONS.map((r) => r.gameId);
    const result = alignedRecordedReasons(ids, METADATA);
    expect(result).toEqual(REASONS);
    expect(result).not.toBe(METADATA.reasons);
    expect(result![0]).not.toBe(REASONS[0]);
  });
});
