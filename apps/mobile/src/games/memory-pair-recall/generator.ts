/**
 * Deterministic pair-round generation for the Pair Recall game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is drawn from a
 * per-round RNG fork, so rounds are independent and a re-draw never
 * resequences another round.
 *
 * Interference re-pairing (the mechanic's core): from round 1 on, the round
 * CARRIES OVER up to `pairCount - 1` stimuli from the previous round (always
 * at least one when the previous round exists) and gives every carried
 * stimulus a NEW response — different from the partner it had last round — so
 * associations learned earlier become proactive-interference traps. Remaining
 * slots are filled with fresh stimuli. Responses are unique within a round,
 * and the response palette for recall is exactly the round's own responses
 * (every decoy is another pair's true partner).
 *
 * Every step is deterministic — the same seed always yields the same session.
 */
import type { Rng } from "@/sdk";

import { RESPONSE_COUNT, STIMULUS_COUNT } from "./pairs";
import type { PairRecallRound, StimulusResponsePair } from "./types";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ROUND_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly pairCount: number;
  /** Previous round, or null for round 0. */
  readonly prevRound: PairRecallRound | null;
}

/** How many stimuli may be carried over from the previous round. */
export function carryOverCount(pairCount: number, prevRound: PairRecallRound | null): number {
  if (prevRound === null || prevRound.pairs.length === 0) {
    return 0;
  }
  // Keep at least one carried stimulus whenever possible: that single
  // re-paired association is enough to make stale learning matter.
  return Math.min(Math.max(1, pairCount - 1), prevRound.pairs.length);
}

/**
 * Build one candidate round deterministically from a forked rng.
 *
 * Carried stimuli come from the previous round's cue order (front first), each
 * re-paired with a response different from its previous one; fresh stimuli are
 * drawn from the remaining pool. All responses stay unique within the round.
 */
function buildRound(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  pairCount: number,
  prevRound: PairRecallRound | null,
): PairRecallRound {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);

  const stimulusPool = fork.fork("stimuli").shuffle(
    Array.from({ length: STIMULUS_COUNT }, (_, i) => i),
  );
  const responsePool = fork.fork("responses").shuffle(
    Array.from({ length: RESPONSE_COUNT }, (_, i) => i),
  );

  const pairs: StimulusResponsePair[] = [];
  const usedStimuli = new Set<number>();
  const usedResponses = new Set<number>();

  const prevResponseOf = (stimulusId: number): number | null => {
    if (prevRound === null) {
      return null;
    }
    const found = prevRound.pairs.find((p) => p.stimulusId === stimulusId);
    return found === undefined ? null : found.responseId;
  };

  // 1. Carry over previous stimuli (previous cue order, front first).
  const carry = prevRound === null ? [] : prevRound.cueOrder.slice(0, carryOverCount(pairCount, prevRound));
  for (const prevIndex of carry) {
    if (pairs.length >= pairCount) {
      break;
    }
    const stimulusId = prevRound!.pairs[prevIndex].stimulusId;
    if (usedStimuli.has(stimulusId)) {
      continue;
    }
    const prevResponse = prevResponseOf(stimulusId);
    // Re-pairing interference: never reuse the previous partner.
    const candidate = responsePool.find(
      (id) => !usedResponses.has(id) && id !== prevResponse,
    );
    if (candidate === undefined) {
      continue;
    }
    pairs.push({ stimulusId, responseId: candidate });
    usedStimuli.add(stimulusId);
    usedResponses.add(candidate);
  }

  // 2. Fill the rest with fresh stimuli + unused responses. A stimulus that
  // returns from a previous round via this path is still RE-PAIRED: its old
  // partner is never a valid answer (the interference invariant applies to
  // every returning stimulus, however it got in).
  for (const stimulusId of stimulusPool) {
    if (pairs.length >= pairCount) {
      break;
    }
    if (usedStimuli.has(stimulusId)) {
      continue;
    }
    const prevResponse = prevResponseOf(stimulusId);
    const candidate = responsePool.find(
      (id) => !usedResponses.has(id) && id !== prevResponse,
    );
    if (candidate === undefined) {
      break;
    }
    pairs.push({ stimulusId, responseId: candidate });
    usedStimuli.add(stimulusId);
    usedResponses.add(candidate);
  }

  // 3. Seeded presentation orders: cues scramble the pair list; the response
  // palette is the round's own responses in a seeded order.
  const indices = Array.from({ length: pairs.length }, (_, i) => i);
  const cueOrder = fork.fork("cues").shuffle(indices);
  const responseOptions = fork
    .fork("palette")
    .shuffle(pairs.map((p) => p.responseId));

  return { pairs, cueOrder, responseOptions };
}

/**
 * Generate one round deterministically. The interference invariant (every
 * carried stimulus gets a NEW partner) is enforced by construction; the
 * near-duplicate guard rejects a degenerate candidate identical to the
 * previous round as a belt-and-braces check.
 */
export function generateRound(input: GenerateRoundInput): PairRecallRound {
  const { rng, roundIndex, pairCount, prevRound } = input;
  if (pairCount <= 0 || !Number.isInteger(pairCount)) {
    throw new RangeError(
      `generateRound: pairCount must be a positive integer, got ${pairCount}`,
    );
  }
  if (pairCount > STIMULUS_COUNT || pairCount > RESPONSE_COUNT) {
    throw new RangeError(
      `generateRound: pairCount ${pairCount} exceeds palette capacity (${STIMULUS_COUNT} stimuli / ${RESPONSE_COUNT} responses)`,
    );
  }

  let candidate: PairRecallRound = buildRound(rng, roundIndex, 0, pairCount, prevRound);
  for (let attempt = 1; attempt < MAX_ROUND_ATTEMPTS; attempt += 1) {
    if (!isNearDuplicateRound(candidate, prevRound)) {
      return candidate;
    }
    candidate = buildRound(rng, roundIndex, attempt, pairCount, prevRound);
  }
  return candidate;
}

/**
 * True when `candidate` would feel like a free repeat of `prev`: identical
 * pair map (same stimulus → same response everywhere). With the re-pairing
 * rule this can only happen when nothing carried over, but the guard keeps
 * the no-free-repeat guarantee explicit.
 */
export function isNearDuplicateRound(
  candidate: PairRecallRound,
  prev: PairRecallRound | null,
): boolean {
  if (prev === null || prev.pairs.length !== candidate.pairs.length) {
    return false;
  }
  const prevMap = new Map(prev.pairs.map((p) => [p.stimulusId, p.responseId]));
  return candidate.pairs.every(
    (p) => prevMap.get(p.stimulusId) === p.responseId,
  );
}

/**
 * Validation oracle used by tests: unique stimuli, unique responses, valid
 * palette ids, a cue order that is a permutation of the pair indices, a
 * response palette containing exactly the round's responses, and — when a
 * previous round exists — at least one carried stimulus whose response CHANGED
 * (the interference guarantee).
 */
export function validateRound(
  round: PairRecallRound,
  prevRound: PairRecallRound | null,
): boolean {
  if (round.pairs.length === 0) {
    return false;
  }
  const stimuli = new Set(round.pairs.map((p) => p.stimulusId));
  const responses = new Set(round.pairs.map((p) => p.responseId));
  if (stimuli.size !== round.pairs.length || responses.size !== round.pairs.length) {
    return false;
  }
  for (const p of round.pairs) {
    if (
      !Number.isInteger(p.stimulusId) ||
      p.stimulusId < 0 ||
      p.stimulusId >= STIMULUS_COUNT ||
      !Number.isInteger(p.responseId) ||
      p.responseId < 0 ||
      p.responseId >= RESPONSE_COUNT
    ) {
      return false;
    }
  }
  // Cue order must be a permutation of [0, pairs.length).
  if (round.cueOrder.length !== round.pairs.length) {
    return false;
  }
  const cueSet = new Set(round.cueOrder);
  for (let i = 0; i < round.pairs.length; i += 1) {
    if (!cueSet.has(i)) {
      return false;
    }
  }
  // Response palette must contain exactly this round's responses.
  if (round.responseOptions.length !== round.pairs.length) {
    return false;
  }
  const optionSet = new Set(round.responseOptions);
  if (optionSet.size !== responses.size) {
    return false;
  }
  for (const id of responses) {
    if (!optionSet.has(id)) {
      return false;
    }
  }
  // Interference guarantee: a carried stimulus must have been re-paired.
  if (prevRound !== null) {
    const prevMap = new Map(prevRound.pairs.map((p) => [p.stimulusId, p.responseId]));
    let carried = 0;
    for (const p of round.pairs) {
      const prevResponse = prevMap.get(p.stimulusId);
      if (prevResponse !== undefined) {
        carried += 1;
        if (prevResponse === p.responseId) {
          return false;
        }
      }
    }
    if (carried < Math.min(1, prevRound.pairs.length)) {
      return false;
    }
  }
  return true;
}
