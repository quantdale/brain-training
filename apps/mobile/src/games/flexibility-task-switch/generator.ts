/**
 * Deterministic round generation for the Task Switch game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is:
 *
 *   1. A cued task (parity / magnitude / color), chosen deterministically with
 *      a `switchRate` probability of differing from the previous trial's task.
 *   2. A token (number + color + shape).
 *   3. The task's fixed ordered answer options, with exactly one correct.
 *
 * Invariants (validated per round by `validateRound` — the generator
 * self-checks and throws on violation):
 *
 *   1. Exactly ONE option equals `correctAnswerFor(task, token)`.
 *   2. Options are distinct and equal to `TASK_ANSWERS[task]`.
 *   3. `correctIndex` points at the correct option.
 *   4. The token is within the active alphabet (color/shape/number).
 *
 * Determinism: same seed → same session. Never use Math.random.
 */
import type { Rng } from "@/sdk";
import { createRng } from "@/sdk";

import {
 TOKEN_COLORS,
 TOKEN_SHAPES,
 TASK_ANSWERS,
 correctAnswerFor,
} from "./types";
import type {
 FlexibilityTaskSwitchDifficultyParams,
 GeneratedRound,
 TaskId,
 Token,
} from "./types";

/** Upper bound on re-draw attempts (unused for token draw but kept for symmetry). */
export const MAX_GENERATE_ATTEMPTS = 12;

/** Choose the trial's task: random for round 0; else switch with `switchRate`. */
function pickTask(
 rng: Rng,
 index: number,
 prevTask: TaskId | null,
 pool: readonly TaskId[],
 switchRate: number,
): TaskId {
 if (prevTask === null) {
  return rng.fork(`round:${index}:task`).pick(pool);
 }
 if (pool.length <= 1) {
  return prevTask;
 }
 if (rng.fork(`round:${index}:task-switch`).next() < switchRate) {
  const others = pool.filter((t) => t !== prevTask);
  return rng.fork(`round:${index}:task`).pick(others);
 }
 return prevTask;
}

/**
 * Deterministic token (number + color + shape) for a round.
 *
 * The fork salts MUST be scoped by `index`: `Rng.fork(salt)` derives the child
 * stream from the parent's canonical seed string alone (parent consumption
 * does not advance it), so a constant salt would yield the identical token on
 * every round of a session.
 */
function pickToken(
 rng: Rng,
 index: number,
 params: FlexibilityTaskSwitchDifficultyParams,
): Token {
 const colors = TOKEN_COLORS.slice(0, params.numColors);
 const shapes = TOKEN_SHAPES.slice(0, params.numShapes);
 const color = rng.fork(`round:${index}:token:color`).pick(colors);
 const shape = rng.fork(`round:${index}:token:shape`).pick(shapes);
 const number = rng.fork(`round:${index}:token:number`).nextIntRange(1, params.numNumbers + 1);
 return { number, color, shape };
}

/** Build one round deterministically. */
export function generateRound(
 rng: Rng,
 index: number,
 prevTask: TaskId | null,
 params: FlexibilityTaskSwitchDifficultyParams,
): GeneratedRound {
 const task = pickTask(
  rng,
  index,
  prevTask,
  params.taskPool,
  params.switchRate,
 );
 const token = pickToken(rng, index, params);
 const options = TASK_ANSWERS[task];
 const correct = correctAnswerFor(task, token);
 const correctIndex = options.indexOf(correct);
 const isSwitch = prevTask !== null && task !== prevTask;
 const round: GeneratedRound = { task, token, options, correctIndex, isSwitch };
 const violations = validateRound(round, params.numColors, params.numShapes);
 if (violations.length > 0) {
  throw new Error(
   `flexibility-task-switch: generated round ${index} violates invariants: ${violations.join("; ")}`,
  );
 }
 return round;
}

/** Build the full deterministic session plan. */
export function generateSession(
 seed: string,
 params: FlexibilityTaskSwitchDifficultyParams,
): GeneratedRound[] {
 const rng = createRng(seed);
 const rounds: GeneratedRound[] = [];
 let prevTask: TaskId | null = null;
 for (let i = 0; i < params.rounds; i += 1) {
  const round = generateRound(rng, i, prevTask, params);
  rounds.push(round);
  prevTask = round.task;
 }
 return rounds;
}

/**
 * Validate the round invariants (see module docs). Returns the list of
 * violations (empty = valid). Exported for tests and used by the generator's
 * self-check. `isSwitch` is not checked here (it depends on the previous
 * trial); `validatePlan` checks switch consistency across a plan.
 */
export function validateRound(
 round: GeneratedRound,
 numColors: number,
 numShapes: number,
): string[] {
 const violations: string[] = [];
 const { task, token, options, correctIndex } = round;
 const expected = TASK_ANSWERS[task];
 if (options.length !== expected.length) {
  violations.push(`expected ${expected.length} options, got ${options.length}`);
 }
 const correct = correctAnswerFor(task, token);
 const correctCount = options.filter((o) => o === correct).length;
 if (correctCount !== 1) {
  violations.push(`expected exactly one correct option, found ${correctCount}`);
 }
 const seen = new Set<string>();
 for (const o of options) {
  if (seen.has(o)) {
   violations.push(`duplicate option "${o}"`);
  }
  seen.add(o);
 }
 if (
  !Number.isInteger(correctIndex) ||
  correctIndex < 0 ||
  correctIndex >= options.length
 ) {
  violations.push(`correctIndex ${correctIndex} out of range`);
 } else if (options[correctIndex] !== correct) {
  violations.push(`correctIndex does not point at the correct option`);
 }
 const colors = TOKEN_COLORS.slice(0, numColors);
 const shapes = TOKEN_SHAPES.slice(0, numShapes);
 if (!colors.includes(token.color)) {
  violations.push("token color is outside the active alphabet");
 }
 if (!shapes.includes(token.shape)) {
  violations.push("token shape is outside the active alphabet");
 }
 if (!Number.isInteger(token.number) || token.number < 1 || token.number > 9) {
  violations.push(`token number ${token.number} out of range`);
 }
 return violations;
}

/**
 * Validate switch-consistency across a full plan: `isSwitch` must equal
 * (index > 0 && task != previous task). Returns violations (empty = valid).
 */
export function validatePlan(plan: readonly GeneratedRound[]): string[] {
 const violations: string[] = [];
 for (let i = 0; i < plan.length; i += 1) {
  const round = plan[i];
  const expectedSwitch = i > 0 && round.task !== plan[i - 1].task;
  if (round.isSwitch !== expectedSwitch) {
   violations.push(
    `round ${i} isSwitch=${round.isSwitch} but expected ${expectedSwitch}`,
   );
  }
 }
 return violations;
}
