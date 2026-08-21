/**
 * Deterministic round generation for the Symbol Tracker game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round draws its board
 * from a per-round RNG fork, so rounds are independent.
 *
 * Mechanic: place `tokenCount` distinct symbols on the board; highlight
 * `trackCount` of them as the targets to remember. After the observe window
 * the symbols relocate to new cells (a discrete scramble — no continuous
 * animation timing) and `distractors` extra symbols appear. The correct answer
 * is the SET of tracked symbol ids (by identity).
 *
 * Near-duplicate avoidance: two consecutive rounds whose tracked symbol-id SET
 * is identical give the player a free pass, so a candidate is re-drawn with an
 * incremented attempt salt until the tracked set differs (or the budget is
 * exhausted). Every step is deterministic — the same seed always yields the
 * same session.
 */
import type { Rng } from '@/sdk';

import { TRACKER_SYMBOL_COUNT } from './symbols';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ROUND_ATTEMPTS = 12;

/** Empty-cell sentinel. */
export const EMPTY = -1;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly gridSize: number;
  readonly tokenCount: number;
  readonly trackCount: number;
  readonly distractors: number;
  /** Previous round's tracked symbol ids, or null for round 0. */
  readonly prevTracked: readonly number[] | null;
}

export interface GeneratedRound {
  /** Observe board: symbol id per cell (-1 empty). */
  readonly observeBoard: number[];
  /** Respond board: symbol id per cell (-1 empty), scrambled + distractors. */
  readonly respondBoard: number[];
  /** The tracked symbol ids (the answer). */
  readonly trackedSymbolIds: number[];
}

function buildRound(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  gridSize: number,
  tokenCount: number,
  trackCount: number,
  distractors: number,
): GeneratedRound {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
  const paletteIds = Array.from({ length: TRACKER_SYMBOL_COUNT }, (_, i) => i);
  const allCells = Array.from({ length: gridSize }, (_, i) => i);

  const tokenSymbolIds = fork.fork('tokens').shuffle(paletteIds).slice(0, tokenCount);
  const tokenCells = fork.fork('cells').shuffle(allCells).slice(0, tokenCount);

  const observeBoard = new Array<number>(gridSize).fill(EMPTY);
  tokenCells.forEach((cell, i) => {
    observeBoard[cell] = tokenSymbolIds[i];
  });

  const trackedLocal = fork.fork('tracked').shuffle(tokenCells.map((_, i) => i)).slice(0, trackCount);
  const trackedSymbolIds = trackedLocal.map((i) => tokenSymbolIds[i]).sort((a, b) => a - b);

  // Discrete scramble: relocate each token to a fresh cell order.
  const respondCellOrder = fork.fork('scramble').shuffle(allCells);
  const respondBoard = new Array<number>(gridSize).fill(EMPTY);
  tokenCells.forEach((_, i) => {
    respondBoard[respondCellOrder[i]] = tokenSymbolIds[i];
  });

  // Distractors: symbols NOT among the observe tokens, placed in empty cells.
  const tokenSet = new Set(tokenSymbolIds);
  const avail = paletteIds.filter((id) => !tokenSet.has(id));
  const distractorCount = Math.min(distractors, avail.length, gridSize - tokenCount);
  const distractorIds = fork.fork('distractors').shuffle(avail).slice(0, distractorCount);
  let di = 0;
  for (let c = 0; c < gridSize && di < distractorIds.length; c += 1) {
    if (respondBoard[c] === EMPTY) {
      respondBoard[c] = distractorIds[di];
      di += 1;
    }
  }

  return { observeBoard, respondBoard, trackedSymbolIds };
}

/** Generate one round (with near-duplicate avoidance). */
export function generateRound(input: GenerateRoundInput): GeneratedRound {
  const { rng, roundIndex, gridSize, tokenCount, trackCount, distractors, prevTracked } = input;
  if (gridSize <= 0 || !Number.isInteger(gridSize)) {
    throw new RangeError(`generateRound: gridSize must be a positive integer, got ${gridSize}`);
  }
  if (tokenCount <= 0 || tokenCount > gridSize || tokenCount > TRACKER_SYMBOL_COUNT) {
    throw new RangeError(
      `generateRound: tokenCount must be in (0, min(gridSize, ${TRACKER_SYMBOL_COUNT})], got ${tokenCount}`,
    );
  }
  if (trackCount <= 0 || trackCount > tokenCount) {
    throw new RangeError(`generateRound: trackCount must be in (0, tokenCount], got ${trackCount}`);
  }

  for (let attempt = 0; attempt < MAX_ROUND_ATTEMPTS; attempt += 1) {
    const candidate = buildRound(rng, roundIndex, attempt, gridSize, tokenCount, trackCount, distractors);
    if (!isNearDuplicateTracked(candidate.trackedSymbolIds, prevTracked)) {
      return candidate;
    }
  }
  return buildRound(rng, roundIndex, MAX_ROUND_ATTEMPTS - 1, gridSize, tokenCount, trackCount, distractors);
}

/** True when the new tracked set is identical to the previous round's (too easy). */
export function isNearDuplicateTracked(
  candidate: readonly number[],
  prev: readonly number[] | null,
): boolean {
  if (prev === null) {
    return false;
  }
  if (candidate.length !== prev.length) {
    return false;
  }
  const a = [...candidate].sort((x, y) => x - y);
  const b = [...prev].sort((x, y) => x - y);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
