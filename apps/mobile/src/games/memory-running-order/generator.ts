/**
 * Deterministic stream generation for the Running Order game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's stream is drawn
 * from a per-round RNG fork; positions are independent, so re-drawing uses a
 * different salt rather than reshuffling a shared draw.
 *
 * Working-memory pressure: only the LAST `recallLength` symbols matter; the
 * earlier items are distractors the player must let go of. The "target" is
 * therefore `stream.slice(streamLen - recallLength)`.
 *
 * Near-duplicate avoidance: two consecutive rounds whose trailing targets are
 * identical give the player a free pass (they can coast on the previous
 * answer), so a candidate stream is re-drawn with an incremented attempt salt
 * until the trailing target differs from the previous round's (or the budget
 * is exhausted). Every step is deterministic — the same seed always yields the
 * same session.
 */
import type { Rng } from "@/sdk";

import { SYMBOL_COUNT } from "./symbols";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_STREAM_ATTEMPTS = 12;

export interface GenerateStreamInput {
 readonly rng: Rng;
 /** 0-based round index; part of the fork salt. */
 readonly roundIndex: number;
 /** Full stream length (distractors + recall portion). */
 readonly streamLen: number;
 /** Number of trailing symbols to recall. */
 readonly recallLength: number;
 /** Previous round's trailing target, or null for round 0. */
 readonly prevTarget: readonly number[] | null;
}

/** Generate the full stimulus stream for a round. */
export function generateStream(input: GenerateStreamInput): number[] {
 const { rng, roundIndex, streamLen, recallLength, prevTarget } = input;
 if (streamLen <= 0 || recallLength <= 0 || recallLength > streamLen) {
  throw new RangeError(
   `generateStream: need 0 < recallLength <= streamLen, got recallLength=${recallLength} streamLen=${streamLen}`,
  );
 }

 for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt += 1) {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
  const stream: number[] = [];
  for (let i = 0; i < streamLen; i += 1) {
   stream.push(fork.fork(`pos:${i}`).nextInt(SYMBOL_COUNT));
  }
  const target = stream.slice(streamLen - recallLength);
  if (!isNearDuplicateTarget(target, prevTarget)) {
   return stream;
  }
 }

 // Extremely unlikely fallback: deterministically accept the last draw.
 const fork = rng.fork(
  `round:${roundIndex}:attempt:${MAX_STREAM_ATTEMPTS - 1}`,
 );
 const stream: number[] = [];
 for (let i = 0; i < streamLen; i += 1) {
  stream.push(fork.fork(`pos:${i}`).nextInt(SYMBOL_COUNT));
 }
 return stream;
}

/** The trailing recall target of a stream. */
export function streamTarget(
 stream: readonly number[],
 recallLength: number,
): number[] {
 return stream.slice(stream.length - recallLength);
}

/** True when the new target is identical to the previous round's (too easy). */
export function isNearDuplicateTarget(
 candidate: readonly number[],
 prev: readonly number[] | null,
): boolean {
 if (prev === null) {
  return false;
 }
 if (candidate.length !== prev.length) {
  return false;
 }
 for (let i = 0; i < candidate.length; i += 1) {
  if (candidate[i] !== prev[i]) {
   return false;
  }
 }
 return true;
}
