/**
 * Deterministic board generation for the Odd One Out game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's board comes
 * from a per-round RNG fork and satisfies the core invariant: EXACTLY ONE odd
 * item — a single `oddIndex` plus one deviation spec, and every other item
 * renders identically to the majority (verified structurally by
 * `renderSpecFor`, which the UI also uses).
 *
 * Deviation catalog: `DEVIATION_VARIANTS[subtlety]` holds 2–3 candidate
 * deviations per subtlety level (0 = easiest … 3 = hardest): shape swaps,
 * high/low-contrast color swaps, and orientation flips. Colors are a fixed
 * palette chosen to stay discriminable on both light and dark surfaces.
 *
 * Near-duplicate avoidance: consecutive boards are confusable when the odd
 * item sits on the same index (a verbatim repeat) or when the same deviation
 * variant is used on two nearby positions, so candidates are re-drawn with an
 * incremented attempt salt until they clear the distance rule or the budget
 * is exhausted. Every step is deterministic — the same seed always yields
 * the same session.
 */
import type { Rng } from '@/sdk';

import type { DeviationSpec, OddOneOutBoard } from './types';

/** Deviation palette (fixed hex; discriminable on light and dark surfaces). */
const INDIGO = '#4F6BFF';
const GREEN = '#1E9E62';
const ORANGE = '#D98E04';
const RED = '#D5485B';
const SLATE = '#5D6474';
const GRAY = '#9AA1B5';
const PALE_INDIGO = '#8B9BFF';

/** Subtlety 0 (easiest): shape swaps. */
const SHAPE_VARIANTS: readonly DeviationSpec[] = [
  { kind: 'shape', key: 'shape-circle-square', glyph: '●', color: null, rotation: 0, oddGlyph: '■', oddColor: null, oddRotation: 0 },
  { kind: 'shape', key: 'shape-triangle-circle', glyph: '▲', color: null, rotation: 0, oddGlyph: '●', oddColor: null, oddRotation: 0 },
];

/** Subtlety 1: high-contrast color swaps (same shape, clearly different hue). */
const COLOR_HIGH_VARIANTS: readonly DeviationSpec[] = [
  { kind: 'color', key: 'color-indigo-green', glyph: '●', color: INDIGO, rotation: 0, oddGlyph: '●', oddColor: GREEN, oddRotation: 0 },
  { kind: 'color', key: 'color-indigo-orange', glyph: '●', color: INDIGO, rotation: 0, oddGlyph: '●', oddColor: ORANGE, oddRotation: 0 },
  { kind: 'color', key: 'color-green-red', glyph: '●', color: GREEN, rotation: 0, oddGlyph: '●', oddColor: RED, oddRotation: 0 },
];

/** Subtlety 2: orientation flips (90°/270°) plus a medium-contrast color swap. */
const ORIENTATION_VARIANTS: readonly DeviationSpec[] = [
  { kind: 'orientation', key: 'orientation-triangle-90', glyph: '▲', color: null, rotation: 0, oddGlyph: '▲', oddColor: null, oddRotation: 90 },
  { kind: 'orientation', key: 'orientation-triangle-270', glyph: '▲', color: null, rotation: 0, oddGlyph: '▲', oddColor: null, oddRotation: 270 },
  { kind: 'color', key: 'color-slate-indigo', glyph: '●', color: SLATE, rotation: 0, oddGlyph: '●', oddColor: INDIGO, oddRotation: 0 },
];

/** Subtlety 3 (hardest): 180° flips, the 45°-rotated diamond, and a low-contrast color swap. */
const SUBTLE_VARIANTS: readonly DeviationSpec[] = [
  { kind: 'orientation', key: 'orientation-triangle-180', glyph: '▲', color: null, rotation: 0, oddGlyph: '▲', oddColor: null, oddRotation: 180 },
  { kind: 'orientation', key: 'orientation-diamond-45', glyph: '◆', color: null, rotation: 0, oddGlyph: '◆', oddColor: null, oddRotation: 45 },
  { kind: 'color', key: 'color-gray-pale-indigo', glyph: '●', color: GRAY, rotation: 0, oddGlyph: '●', oddColor: PALE_INDIGO, oddRotation: 0 },
];

/** Candidate deviations per subtlety level (index = subtlety). */
export const DEVIATION_VARIANTS: readonly (readonly DeviationSpec[])[] = [
  SHAPE_VARIANTS,
  COLOR_HIGH_VARIANTS,
  ORIENTATION_VARIANTS,
  SUBTLE_VARIANTS,
];

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_BOARD_ATTEMPTS = 12;

/** Minimum Manhattan distance between consecutive odd positions with the same deviation. */
export const MIN_ODD_DISTANCE = 2;

export interface GenerateBoardInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Deviation subtlety of this round (see DEVIATION_VARIANTS). */
  readonly subtlety: number;
  readonly gridSize: number;
  /** Previous round's board, or null for round 0. */
  readonly prevBoard: OddOneOutBoard | null;
}

/**
 * Render description for one board position: the odd item differs from the
 * majority by exactly the board's deviation dimension (glyph, color, or
 * rotation), and all other positions are identical to the majority spec.
 * The UI and the generator tests consume the same definition.
 */
export function renderSpecFor(
  deviation: DeviationSpec,
  isOdd: boolean,
): { glyph: string; color: string | null; rotation: number } {
  return isOdd
    ? { glyph: deviation.oddGlyph, color: deviation.oddColor, rotation: deviation.oddRotation }
    : { glyph: deviation.glyph, color: deviation.color, rotation: deviation.rotation };
}

/** Manhattan distance between two grid positions (square grid). */
export function manhattanDistance(a: number, b: number, gridSize: number): number {
  const side = Math.round(Math.sqrt(gridSize));
  const rowA = Math.floor(a / side);
  const colA = a % side;
  const rowB = Math.floor(b / side);
  const colB = b % side;
  return Math.abs(rowA - rowB) + Math.abs(colA - colB);
}

/**
 * True when `candidate` is confusable with the previous round's board: the
 * odd item sits on the same index (verbatim repeat) or the same deviation
 * variant lands within `MIN_ODD_DISTANCE`. A null previous board (round 0)
 * never confuses.
 */
export function isConfusable(
  prev: OddOneOutBoard | null,
  candidate: OddOneOutBoard,
  gridSize: number,
): boolean {
  if (prev === null) {
    return false;
  }
  if (candidate.oddIndex === prev.oddIndex) {
    return true;
  }
  if (candidate.deviation.key === prev.deviation.key) {
    return manhattanDistance(candidate.oddIndex, prev.oddIndex, gridSize) < MIN_ODD_DISTANCE;
  }
  return false;
}

function assertSubtletyInRange(subtlety: number): void {
  if (!Number.isInteger(subtlety) || subtlety < 0 || subtlety >= DEVIATION_VARIANTS.length) {
    throw new RangeError(
      `attention-odd-one-out: subtlety must be an integer in [0, ${DEVIATION_VARIANTS.length - 1}], got ${subtlety}`,
    );
  }
}

/**
 * Generate one board: pick the odd index and a deviation variant for the
 * round's subtlety from a seeded fork, rejecting confusable candidates until
 * the budget is exhausted. Deterministic: the same inputs always yield the
 * same board.
 */
export function generateBoard(input: GenerateBoardInput): OddOneOutBoard {
  const { rng, roundIndex, subtlety, gridSize, prevBoard } = input;
  assertSubtletyInRange(subtlety);
  const variants = DEVIATION_VARIANTS[subtlety];

  let candidate: OddOneOutBoard = { oddIndex: 0, deviation: variants[0] };
  for (let attempt = 0; attempt < MAX_BOARD_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`board:${roundIndex}:attempt:${attempt}`);
    candidate = { oddIndex: fork.nextInt(gridSize), deviation: fork.pick(variants) };
    if (!isConfusable(prevBoard, candidate, gridSize)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return candidate;
}
