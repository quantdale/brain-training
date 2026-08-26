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
 * Near-duplicate avoidance: consecutive rounds whose trailing targets are
 * nearly identical let the player coast (an exact repeat is a free pass, and a
 * one-symbol difference is barely harder), so a candidate stream is re-drawn
 * with an incremented attempt salt until its Hamming distance from the
 * previous round's trailing target is at least `MIN_TARGET_HAMMING_DISTANCE`
 * — mirroring the sibling Memory-family games' sequence guard (or the budget
 * is exhausted). Every step is deterministic — the same seed always yields the
 * same session.
 */
import type { Rng } from "@/sdk";

import { SYMBOL_COUNT } from "./symbols";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_STREAM_ATTEMPTS = 12;

/** Minimum Hamming distance between consecutive rounds' trailing targets. */
export const MIN_TARGET_HAMMING_DISTANCE = 2;

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

/**
 * Hamming-style distance between two trailing targets: absolute length
 * difference plus the number of positions where the symbols differ (mirrors
 * the sibling Memory-family generators' sequence distance). A `null` previous
 * target (round 0) counts as infinitely far.
 */
export function targetDistance(
 a: readonly number[],
 b: readonly number[] | null,
): number {
 if (b === null) {
  return Number.POSITIVE_INFINITY;
 }
 let distance = Math.abs(a.length - b.length);
 const shared = Math.min(a.length, b.length);
 for (let i = 0; i < shared; i += 1) {
  if (a[i] !== b[i]) {
   distance += 1;
  }
 }
 return distance;
}

/**
 * True when the new target is confusable with the previous round's: closer
 * than `MIN_TARGET_HAMMING_DISTANCE` (identical, one position off, or a
 * one-symbol window change that would let the player coast on a shared
 * prefix). Short (<2 symbol) windows are never flagged.
 */
export function isNearDuplicateTarget(
 candidate: readonly number[],
 prev: readonly number[] | null,
): boolean {
 if (prev === null || prev.length < 2) {
  return false;
 }
 return targetDistance(candidate, prev) < MIN_TARGET_HAMMING_DISTANCE;
}
