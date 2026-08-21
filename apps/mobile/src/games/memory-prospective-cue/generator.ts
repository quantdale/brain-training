/**
 * Deterministic round generation for the Cue Keeper game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is drawn from a
 * per-round RNG fork, so rounds are independent and a re-draw never
 * resequences another round.
 *
 * Intention lifecycle (the mechanic's core):
 *   - Round 1: `signalCount` fresh signals, all briefed as NEW.
 *   - Later rounds: exactly ONE previously-active signal retires whenever
 *     possible (announced at briefing), survivors carry over UNANNOUNCED,
 *     and fresh signals join until the round's target count is reached
 *     (briefed once). If the target is BELOW the survivor count (adaptive
 *     step-down), the extra survivors retire too — every departure is
 *     announced. A just-retired glyph cannot return as NEW in the same
 *     round; it may genuinely return in later rounds.
 *   - Every active signal appears EXACTLY ONCE per stream: the player can
 *     never trade "how many are left?" reasoning for holding intentions.
 *
 * Every step is deterministic — the same seed always yields the same session.
 */
import type { Rng } from "@/sdk";

import { GLYPH_COUNT } from "./glyphs";
import type { ProspectiveRound, StreamItem } from "./types";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ROUND_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Target number of simultaneously active signals this round. */
  readonly signalCount: number;
  /** Stream length (items). */
  readonly streamLen: number;
  /** Active signal set of the previous round, or null/empty for round 1. */
  readonly prevActiveSignalIds: readonly number[] | null;
}

/**
 * Split the previous active set into (survivors, retired): one seeded
 * retirement whenever the previous set has ≥ 2 members, plus enough further
 * seeded retirements to fit a shrinking target. Returns the empty split for
 * the first round.
 */
export function splitCarryOver(
  rng: Rng,
  prevActiveSignalIds: readonly number[] | null,
  signalCount: number,
): { survivors: number[]; retired: number[] } {
  if (prevActiveSignalIds === null || prevActiveSignalIds.length === 0) {
    return { survivors: [], retired: [] };
  }
  const pool = rng.shuffle([...prevActiveSignalIds]);
  // Keep at most `signalCount` survivors; always retire at least one when the
  // previous watchlist had ≥ 2 members so the list keeps churning.
  const keepLimit =
    prevActiveSignalIds.length >= 2
      ? Math.min(signalCount, pool.length - 1)
      : Math.min(signalCount, pool.length);
  const survivors = pool.slice(0, Math.max(0, keepLimit));
  const retired = pool.slice(survivors.length);
  return { survivors, retired };
}

/**
 * Build one candidate round deterministically from a forked rng.
 */
function buildRound(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  signalCount: number,
  streamLen: number,
  prevActiveSignalIds: readonly number[] | null,
): ProspectiveRound {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);

  const { survivors, retired } = splitCarryOver(
    fork.fork("carry"),
    prevActiveSignalIds,
    signalCount,
  );

  // Fresh signals: drawn from glyphs that are neither active nor just
  // retired, so a briefed departure never immediately re-enters as new.
  const excluded = new Set([...survivors, ...retired]);
  const freshPool = fork
    .fork("fresh")
    .shuffle(Array.from({ length: GLYPH_COUNT }, (_, i) => i))
    .filter((id) => !excluded.has(id));
  const newSignalIds = freshPool.slice(
    0,
    Math.max(0, signalCount - survivors.length),
  );
  const activeSignalIds = [...survivors, ...newSignalIds];

  // Stream: each active signal exactly once + filler glyphs from the
  // non-active remainder (filler repeats allowed), then one seeded shuffle.
  const activeSet = new Set(activeSignalIds);
  const signalItems: StreamItem[] = activeSignalIds.map((glyphId) => ({
    glyphId,
    isSignal: true,
  }));
  const fillerPool = Array.from(
    { length: GLYPH_COUNT },
    (_, i) => i,
  ).filter((id) => !activeSet.has(id));
  const fillerRng = fork.fork("fillers");
  const fillerItems: StreamItem[] = Array.from(
    { length: Math.max(0, streamLen - signalItems.length) },
    () => ({
      glyphId: fillerPool[fillerRng.nextInt(fillerPool.length)],
      isSignal: false,
    }),
  );
  const items = fork.fork("order").shuffle([...signalItems, ...fillerItems]);

  return { items, activeSignalIds, newSignalIds, retiredSignalIds: retired };
}

/**
 * Generate one round deterministically. The structural invariants (unique
 * active set, each signal exactly once, no retired-to-new reuse within the
 * round) hold by construction; the near-duplicate guard rejects a degenerate
 * candidate whose item sequence repeats the previous round verbatim.
 */
export function generateRound(input: GenerateRoundInput): ProspectiveRound {
  const { rng, roundIndex, signalCount, streamLen, prevActiveSignalIds } = input;
  if (!Number.isInteger(signalCount) || signalCount <= 0) {
    throw new RangeError(
      `generateRound: signalCount must be a positive integer, got ${signalCount}`,
    );
  }
  if (!Number.isInteger(streamLen) || streamLen <= 0) {
    throw new RangeError(
      `generateRound: streamLen must be a positive integer, got ${streamLen}`,
    );
  }
  if (signalCount > GLYPH_COUNT || signalCount > streamLen) {
    throw new RangeError(
      `generateRound: signalCount ${signalCount} exceeds capacity (${GLYPH_COUNT} glyphs / ${streamLen} stream slots)`,
    );
  }

  let candidate = buildRound(
    rng,
    roundIndex,
    0,
    signalCount,
    streamLen,
    prevActiveSignalIds,
  );
  for (let attempt = 1; attempt < MAX_ROUND_ATTEMPTS; attempt += 1) {
    if (
      prevActiveSignalIds === null ||
      !isNearDuplicateRound(candidate, prevActiveSignalIds)
    ) {
      return candidate;
    }
    candidate = buildRound(
      rng,
      roundIndex,
      attempt,
      signalCount,
      streamLen,
      prevActiveSignalIds,
    );
  }
  return candidate;
}

/**
 * True when `candidate` would feel like a free repeat of the previous round:
 * an unchanged active watchlist (same signal set), so the round would test
 * exactly the same held intentions. With per-round forks this is
 * astronomically unlikely, but the guard keeps the no-free-repeat guarantee
 * explicit.
 */
export function isNearDuplicateRound(
  candidate: ProspectiveRound,
  prevActiveSignalIds: readonly number[] | null,
): boolean {
  if (prevActiveSignalIds === null || prevActiveSignalIds.length === 0) {
    return false;
  }
  const prevSet = [...prevActiveSignalIds].sort((a, b) => a - b);
  const nextSet = [...candidate.activeSignalIds].sort((a, b) => a - b);
  if (prevSet.length !== nextSet.length) {
    return false;
  }
  for (let i = 0; i < prevSet.length; i += 1) {
    if (prevSet[i] !== nextSet[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Validation oracle used by tests: valid glyph ids, `isSignal` ⟺ membership
 * in the active set, each active signal appearing exactly once, a unique
 * active set, and — against the previous round — disjoint NEW/retired sets,
 * retirements drawn only from the previous active set, no immediate
 * retired→NEW reuse, and the active set equal to (previous \ retired) ∪ new.
 */
export function validateRound(
  round: ProspectiveRound,
  prevActiveSignalIds: readonly number[] | null,
): boolean {
  const { items, activeSignalIds, newSignalIds, retiredSignalIds } = round;
  if (items.length === 0 || activeSignalIds.length === 0) {
    return false;
  }
  // Glyph ids in range; isSignal flag matches active-set membership.
  const activeSet = new Set(activeSignalIds);
  for (const item of items) {
    if (
      !Number.isInteger(item.glyphId) ||
      item.glyphId < 0 ||
      item.glyphId >= GLYPH_COUNT
    ) {
      return false;
    }
    if (item.isSignal !== activeSet.has(item.glyphId)) {
      return false;
    }
  }
  // Unique active set, all ids in range.
  if (activeSet.size !== activeSignalIds.length) {
    return false;
  }
  for (const id of activeSignalIds) {
    if (!Number.isInteger(id) || id < 0 || id >= GLYPH_COUNT) {
      return false;
    }
  }
  // Each active signal appears exactly once in the stream.
  for (const id of activeSignalIds) {
    let count = 0;
    for (const item of items) {
      if (item.glyphId === id) {
        count += 1;
      }
    }
    if (count !== 1) {
      return false;
    }
  }
  // Intention bookkeeping vs the previous round.
  if (newSignalIds.some((id) => retiredSignalIds.includes(id))) {
    return false;
  }
  if (prevActiveSignalIds === null || prevActiveSignalIds.length === 0) {
    // First round: everything is new, nothing retires.
    return (
      retiredSignalIds.length === 0 &&
      newSignalIds.length === activeSignalIds.length &&
      newSignalIds.every((id) => activeSet.has(id))
    );
  }
  const prevSet = new Set(prevActiveSignalIds);
  if (!retiredSignalIds.every((id) => prevSet.has(id))) {
    return false;
  }
  if (newSignalIds.some((id) => prevSet.has(id))) {
    return false;
  }
  // Active set must be exactly (previous \ retired) ∪ new.
  const expected = new Set(prevActiveSignalIds);
  for (const id of retiredSignalIds) {
    expected.delete(id);
  }
  for (const id of newSignalIds) {
    expected.add(id);
  }
  if (expected.size !== activeSet.size) {
    return false;
  }
  for (const id of activeSignalIds) {
    if (!expected.has(id)) {
      return false;
    }
  }
  return true;
}
