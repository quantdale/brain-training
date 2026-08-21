/**
 * Difficulty-progression view for Progress V2: how the challenge a player
 * attempted evolved over their history of a game or domain.
 *
 * Derived only from the stored per-session difficulty payloads via the shared
 * `extractDifficultyRating` adapter (0..1 scale). Difficulty is presented
 * neutrally — playing harder challenges is a *change*, not inherently "better"
 * — so this module reports direction but never colors it as success/failure.
 */

import type { GameSessionRecord } from '@/db';

import { extractDifficultyRating } from './metrics-map';
import type { Direction, Point } from './types';

/** Difficulty progression over a chronological session set. */
export interface DifficultyProgression {
  /** Whether any session carries an interpretable difficulty payload. */
  available: boolean;
  /** Sessions that contributed a rating. */
  count: number;
  /** Chronological series (oldest first). Empty when unavailable. */
  series: Point[];
  /** First recorded rating (`null` when unavailable). */
  first: number | null;
  /** Most recent recorded rating. */
  latest: number | null;
  /** Highest rating ever recorded in the set. */
  peak: number | null;
  /** `latest - first`; `null` when fewer than two points. */
  delta: number | null;
  direction: Direction;
  /**
   * Share of sessions whose rating is at or above the set's median, in [0, 1]
   * (`null` when unavailable). A simple "how much of your history sits at your
   * typical-or-harder challenge" restatement.
   */
  atOrAboveMedianShare: number | null;
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildDifficultyProgression(
  sessions: readonly GameSessionRecord[],
): DifficultyProgression {
  const ordered = sessions.slice().sort((a, b) => a.completedAt - b.completedAt);
  const series: Point[] = [];
  for (const session of ordered) {
    const value = extractDifficultyRating(session.difficulty);
    if (value !== null) {
      series.push({ t: session.completedAt, value });
    }
  }
  if (series.length === 0) {
    return {
      available: false,
      count: 0,
      series: [],
      first: null,
      latest: null,
      peak: null,
      delta: null,
      direction: 'flat',
      atOrAboveMedianShare: null,
    };
  }

  const values = series.map((p) => p.value);
  const med = median(values);
  const atOrAbove = values.filter((v) => v >= med).length;
  const delta = values.length >= 2 ? values[values.length - 1] - values[0] : null;

  return {
    available: true,
    count: series.length,
    series,
    first: values[0],
    latest: values[values.length - 1],
    peak: Math.max(...values),
    delta,
    direction: delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
    atOrAboveMedianShare: atOrAbove / values.length,
  };
}
