/**
 * Deterministic round generation for the Target Count game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is drawn from a
 * per-round RNG fork so changing one round's salt does not affect others.
 *
 * The grid is built by choosing a target glyph, sampling `distractorClasses`
 * other glyphs, deciding how many target copies to place, then scattering them
 * across shuffled grid positions. Distractor cells are filled by independently
 * sampling from the distractor glyphs (so repeats are allowed, increasing
 * numerosity difficulty).
 *
 * Near-duplicate avoidance: consecutive rounds that reuse BOTH the same target
 * glyph and the same exact count are confusable, so a candidate is re-drawn
 * with an incremented attempt salt until it differs. Every step is
 * deterministic — the same seed always yields the same session.
 */
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { Rng } from '@/sdk';

import type { TargetCountDifficultyParams, TargetCountRound } from './types';

/** Symbol palette (length 6) — must match the spec exactly. */
export const SYMBOLS = ['●', '▲', '■', '◆', '★', '✖'] as const;

/** Human-readable names, index-aligned with `SYMBOLS`. */
export const SYMBOL_NAMES = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross'] as const;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly params: TargetCountDifficultyParams;
  /** Previous round, or null for round 0. */
  readonly prevRound: TargetCountRound | null;
}

/**
 * Build the answer options: the correct count plus neighboring decoys, all
 * clamped to [0, gridSize]. The correct count is always included; the result
 * is shuffled so spatial position carries no information.
 */
export function buildCountOptions(fork: Rng, targetCount: number, gridSize: number): number[] {
  const set = new Set<number>([targetCount]);
  let delta = 1;
  while (
    set.size < 5 &&
    (targetCount - delta >= 0 || targetCount + delta <= gridSize)
  ) {
    if (targetCount - delta >= 0) {
      set.add(targetCount - delta);
    }
    if (set.size >= 5) {
      break;
    }
    if (targetCount + delta <= gridSize) {
      set.add(targetCount + delta);
    }
    delta += 1;
  }
  // Clamp defensively and shuffle for presentation.
  const inRange = [...set].filter((n) => n >= 0 && n <= gridSize);
  return fork.shuffle(inRange);
}

/**
 * Generate one round deterministically. See module docs for the algorithm and
 * the near-duplicate-avoidance loop. The fallback (last candidate) is still
 * fully deterministic because it is derived from a fixed fork salt.
 */
export function generateRound(input: GenerateRoundInput): TargetCountRound {
  const { rng, roundIndex, params, prevRound } = input;
  const { rows, cols, distractorClasses, targetCountRange } = params;
  const gridSize = rows * cols;

  // Candidate carried across attempts so the deterministic fallback is valid.
  let candidate: TargetCountRound | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);

    // Pick the target glyph.
    const targetGlyphIndex = fork.nextInt(SYMBOLS.length);

    // Pick the distinct distractor glyphs (all symbols except the target).
    const others = fork.shuffle(
      Array.from({ length: SYMBOLS.length }, (_, i) => i).filter((i) => i !== targetGlyphIndex),
    );
    const chosen = others.slice(0, Math.min(distractorClasses, others.length));
    const distractorGlyphs = chosen.map((i) => SYMBOLS[i]);

    // Decide how many target copies to place.
    const targetCount = fork.nextIntRange(targetCountRange[0], targetCountRange[1] + 1);

    // Scatter target positions across the shuffled grid.
    const positions = fork.shuffle(Array.from({ length: gridSize }, (_, i) => i));
    const targetPositions = positions.slice(0, targetCount);
    const targetSet = new Set(targetPositions);

    const cells: string[] = new Array(gridSize);
    for (let i = 0; i < gridSize; i += 1) {
      cells[i] = targetSet.has(i) ? SYMBOLS[targetGlyphIndex] : fork.pick(distractorGlyphs);
    }

    const options = buildCountOptions(fork, targetCount, gridSize);

    candidate = {
      cells,
      targetGlyphIndex,
      targetGlyph: SYMBOLS[targetGlyphIndex],
      targetGlyphName: SYMBOL_NAMES[targetGlyphIndex],
      targetCount,
      options,
      gridSize,
      rows,
      cols,
    };

    // Near-duplicate avoidance: skip rounds that repeat BOTH glyph and count.
    if (
      prevRound !== null &&
      prevRound.targetGlyphIndex === targetGlyphIndex &&
      prevRound.targetCount === targetCount
    ) {
      continue;
    }
    return candidate;
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return candidate as TargetCountRound;
}

/** Count how many cells hold the target glyph (the correct answer). */
export function countTargets(cells: readonly string[], targetGlyph: string): number {
  let n = 0;
  for (const cell of cells) {
    if (cell === targetGlyph) {
      n += 1;
    }
  }
  return n;
}

/**
 * Validation oracle used by tests: the options must include the true count and
 * the grid must actually contain exactly `targetCount` copies of the target.
 */
export function validateGeneratedRound(round: TargetCountRound): boolean {
  return (
    round.options.includes(round.targetCount) &&
    countTargets(round.cells, round.targetGlyph) === round.targetCount
  );
}

/** Expose the active RNG algorithm version for diagnostic metadata. */
export const GENERATOR_RNG_VERSION = RNG_ALGORITHM_VERSION;
