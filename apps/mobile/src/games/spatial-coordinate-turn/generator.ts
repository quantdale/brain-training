/**
 * Deterministic generation for the Spatial Coordinate Turn game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round produces:
 *   1. A start at the origin (0,0) facing a start heading.
 *   2. A command sequence (left/right/about/forward/back).
 *   3. The simulated final heading + final position on the free plane.
 *   4. An option set:
 *        - heading task → ALL directions in the active set; correctIndex is
 *          the final heading.
 *        - position task → the final coordinate + plausible distractors
 *          (start, after-first-command, neighbours, mirrored).
 *
 * Invariants:
 *   - The plane is unbounded, so every integer position is valid; there is no
 *     impossible geometry (distinct from the grid-naviator, which must keep the
 *     marker inside grid walls).
 *   - finalHeading/finalPos equal simulate(start, startDir, commands, directions).
 *   - Options are distinct; exactly one is correct; correctIndex points at it.
 *   - For a heading task, every option is a valid direction in the active set.
 */
import { createRng } from '@/sdk';
import type { Rng } from '@/sdk';

import type {
  Command,
  Coord,
  Dir,
  HeadingRound,
  PositionRound,
  SpatialCoordinateTurnDifficultyParams,
  SpatialCoordinateTurnRound,
} from './types';

/** Maximum number of answer options for a position trial. */
export const POSITION_OPTION_COUNT = 4;

/** Direction in clockwise order (used for rotation math). */
const DIR_ORDER_4: readonly Dir[] = ['N', 'E', 'S', 'W'];
const DIR_ORDER_8: readonly Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Row/col (x/y) delta for one step "forward" in a given direction. */
function dirDelta(dir: Dir, directions: 4 | 8): { dx: number; dy: number } {
  if (directions === 4) {
    switch (dir) {
      case 'N':
        return { dx: 0, dy: 1 };
      case 'E':
        return { dx: 1, dy: 0 };
      case 'S':
        return { dx: 0, dy: -1 };
      case 'W':
        return { dx: -1, dy: 0 };
      default:
        return { dx: 0, dy: 0 };
    }
  }
  switch (dir) {
    case 'N':
      return { dx: 0, dy: 1 };
    case 'NE':
      return { dx: 1, dy: 1 };
    case 'E':
      return { dx: 1, dy: 0 };
    case 'SE':
      return { dx: 1, dy: -1 };
    case 'S':
      return { dx: 0, dy: -1 };
    case 'SW':
      return { dx: -1, dy: -1 };
    case 'W':
      return { dx: -1, dy: 0 };
    case 'NW':
      return { dx: -1, dy: 1 };
  }
}

/** The clockwise direction order for a given count. */
export function directionsOrder(directions: 4 | 8): readonly Dir[] {
  return directions === 4 ? DIR_ORDER_4 : DIR_ORDER_8;
}

/**
 * Rotate a direction by `step` positions in the active order.
 * `turn` left = counter-clockwise (-step), right = clockwise (+step).
 * For an 'about' command, callers pass `step = directions / 2` (a 180° turn).
 */
export function rotateDir(dir: Dir, turn: 'left' | 'right', step: number, directions: 4 | 8): Dir {
  const order = directionsOrder(directions);
  const n = order.length;
  const idx = order.indexOf(dir);
  const delta = turn === 'right' ? step : -step;
  return order[(((idx + delta) % n) + n) % n];
}

/** Simulate a command sequence from a start point/direction on the free plane. */
export function simulate(
  start: Coord,
  startDir: Dir,
  commands: readonly Command[],
  directions: 4 | 8,
): { finalPos: Coord; finalHeading: Dir; turnCount: number } {
  let x = start.x;
  let y = start.y;
  let dir: Dir = startDir;
  let turnCount = 0;
  for (const command of commands) {
    if (command.type === 'left' || command.type === 'right') {
      dir = rotateDir(dir, command.type, 1, directions);
      turnCount += 1;
    } else if (command.type === 'about') {
      dir = rotateDir(dir, 'right', directions / 2, directions);
      turnCount += 1;
    } else {
      const stepSign = command.type === 'forward' ? 1 : -1;
      const steps = command.steps ?? 1;
      const { dx, dy } = dirDelta(dir, directions);
      x += dx * stepSign * steps;
      y += dy * stepSign * steps;
    }
  }
  return { finalPos: { x, y }, finalHeading: dir, turnCount };
}

/** Build a command sequence deterministically from an RNG. */
function buildCommandSequence(
  rng: Rng,
  commandCount: number,
  directions: 4 | 8,
  moveMax: number,
): Command[] {
  const commands: Command[] = [];
  for (let i = 0; i < commandCount; i += 1) {
    const roll = rng.next();
    if (roll < 0.42) {
      commands.push({ type: rng.next() < 0.5 ? 'left' : 'right' });
    } else if (roll < 0.58) {
      commands.push({ type: 'about' });
    } else {
      const type: 'forward' | 'back' = rng.next() < 0.5 ? 'forward' : 'back';
      const steps = rng.nextIntRange(1, moveMax + 1);
      commands.push({ type, steps });
    }
  }

  // Guarantee a mix: at least one turn and at least one move, so both the
  // heading and (when used) position tasks are meaningful.
  const hasTurn = commands.some((c) => c.type === 'left' || c.type === 'right' || c.type === 'about');
  const hasMove = commands.some((c) => c.type === 'forward' || c.type === 'back');
  if (!hasTurn && commands.length > 0) {
    const idx = rng.nextInt(commands.length);
    commands[idx] = { type: rng.next() < 0.5 ? 'left' : 'right' };
  }
  if (!hasMove && commands.length > 0) {
    const idx = rng.nextInt(commands.length);
    commands[idx] = { type: 'forward', steps: rng.nextIntRange(1, moveMax + 1) };
  }

  void directions;
  return commands;
}

/** Plausible coordinate distractors for a position trial (distinct, no correct). */
function buildPositionDistractors(
  start: Coord,
  startDir: Dir,
  commands: readonly Command[],
  correct: Coord,
  directions: 4 | 8,
  moveMax: number,
  rng: Rng,
): Coord[] {
  const distractors: Coord[] = [];
  const seen = new Set<string>();
  const key = (c: Coord): string => `${c.x},${c.y}`;

  const tryAdd = (cell: Coord): void => {
    if (cell.x === correct.x && cell.y === correct.y) return;
    const k = key(cell);
    if (seen.has(k)) return;
    seen.add(k);
    distractors.push(cell);
  };

  // 1. Start position.
  tryAdd(start);
  // 2. Position after the first command.
  if (commands.length > 0) {
    tryAdd(simulate(start, startDir, commands.slice(0, 1), directions).finalPos);
  }
  // 3. Position after dropping the last command.
  if (commands.length > 1) {
    tryAdd(simulate(start, startDir, commands.slice(0, -1), directions).finalPos);
  }
  // 4. Neighbours (one step in every active direction).
  for (const d of directionsOrder(directions)) {
    const { dx, dy } = dirDelta(d, directions);
    tryAdd({ x: correct.x + dx, y: correct.y + dy });
  }
  // 5. Mirrored across the origin.
  tryAdd({ x: -correct.x, y: -correct.y });

  // Fill the rest with deterministic nearby cells.
  let guard = 0;
  const span = moveMax + 2;
  while (distractors.length < POSITION_OPTION_COUNT - 1 && guard < 60) {
    const cell: Coord = {
      x: correct.x + rng.nextIntRange(-span, span + 1),
      y: correct.y + rng.nextIntRange(-span, span + 1),
    };
    tryAdd(cell);
    guard += 1;
  }

  return distractors;
}

/**
 * Generate one round. Deterministic given `rng` and `roundIndex`. The marker
 * starts at the origin, so there is never an out-of-bounds failure.
 */
export function generateRound(
  rng: Rng,
  params: SpatialCoordinateTurnDifficultyParams,
  roundIndex: number,
): SpatialCoordinateTurnRound {
  const directions = params.directions;

  const dirRng = rng.fork(`round:${roundIndex}:dir`);
  const startDir = dirRng.pick(directionsOrder(directions));

  const countRng = rng.fork(`round:${roundIndex}:count`);
  const commandCount = countRng.nextIntRange(params.minSteps, params.maxSteps + 1);

  const cmdRng = rng.fork(`round:${roundIndex}:cmds`);
  const commands = buildCommandSequence(cmdRng, commandCount, directions, params.moveMax);

  const start: Coord = { x: 0, y: 0 };
  const sim = simulate(start, startDir, commands, directions);

  // Decide the trial's task. Heading is the default; expert sessions with
  // askPosition turn ~half of the trials into position trials.
  const taskRng = rng.fork(`round:${roundIndex}:task`);
  const task: 'heading' | 'position' =
    params.askPosition && taskRng.next() < 0.5 ? 'position' : 'heading';

  if (task === 'heading') {
    const all = directionsOrder(directions);
    return {
      task: 'heading',
      start,
      startDir,
      commands,
      finalHeading: sim.finalHeading,
      finalPos: sim.finalPos,
      directions,
      commandCount: commands.length,
      turnCount: sim.turnCount,
      options: all,
      correctIndex: all.indexOf(sim.finalHeading),
    } satisfies HeadingRound;
  }

  const distractors = buildPositionDistractors(
    start,
    startDir,
    commands,
    sim.finalPos,
    directions,
    params.moveMax,
    rng.fork(`round:${roundIndex}:distractors`),
  );
  const chosenDistractors = distractors.slice(0, Math.max(0, POSITION_OPTION_COUNT - 1));
  const all: Coord[] = [sim.finalPos, ...chosenDistractors];
  const shuffled = rng.fork(`round:${roundIndex}:options`).shuffle(all);
  const correctIndex = shuffled.findIndex((c) => c.x === sim.finalPos.x && c.y === sim.finalPos.y);
  return {
    task: 'position',
    start,
    startDir,
    commands,
    finalHeading: sim.finalHeading,
    finalPos: sim.finalPos,
    directions,
    commandCount: commands.length,
    turnCount: sim.turnCount,
    options: shuffled,
    correctIndex,
  } satisfies PositionRound;
}

/**
 * Generate a full deterministic session plan. The reducer stores this plan so
 * QA force paths and normalization can count trials accurately.
 */
export function generateSession(
  seed: string,
  params: SpatialCoordinateTurnDifficultyParams,
): SpatialCoordinateTurnRound[] {
  const rng = createRng(seed);
  const rounds: SpatialCoordinateTurnRound[] = [];
  for (let i = 0; i < params.rounds; i += 1) {
    rounds.push(generateRound(rng, params, i));
  }
  return rounds;
}

/**
 * Validate a generated round. Returns a list of violation messages (empty =
 * valid). Checks: finalHeading/finalPos equal simulate(start, startDir,
 * commands, directions); options distinct; exactly one correct option;
 * correctIndex correct; for heading task, all options are valid directions.
 */
export function validateRound(round: SpatialCoordinateTurnRound): string[] {
  const problems: string[] = [];
  const sim = simulate(round.start, round.startDir, round.commands, round.directions);

  if (sim.finalHeading !== round.finalHeading) {
    problems.push(
      `finalHeading ${round.finalHeading} != simulate ${sim.finalHeading}`,
    );
  }
  if (sim.finalPos.x !== round.finalPos.x || sim.finalPos.y !== round.finalPos.y) {
    problems.push(
      `finalPos ${JSON.stringify(round.finalPos)} != simulate ${JSON.stringify(sim.finalPos)}`,
    );
  }
  if (sim.turnCount !== round.turnCount) {
    problems.push(`turnCount ${round.turnCount} != simulate ${sim.turnCount}`);
  }

  const isCorrect = (o: Dir | Coord): boolean =>
    round.task === 'heading'
      ? (o as Dir) === round.finalHeading
      : (o as Coord).x === round.finalPos.x && (o as Coord).y === round.finalPos.y;

  const correctCount = round.options.filter((o) => isCorrect(o)).length;
  if (correctCount !== 1) {
    problems.push(`expected exactly one correct option, found ${correctCount}`);
  }

  const seen = new Set<string>();
  for (let i = 0; i < round.options.length; i += 1) {
    const o = round.options[i];
    const k = round.task === 'heading' ? (o as Dir) : `${(o as Coord).x},${(o as Coord).y}`;
    if (seen.has(k)) {
      problems.push(`option ${i} duplicates an earlier option`);
    }
    seen.add(k);
  }

  if (round.correctIndex < 0 || round.correctIndex >= round.options.length) {
    problems.push(`correctIndex ${round.correctIndex} out of range`);
  } else if (!isCorrect(round.options[round.correctIndex])) {
    problems.push(`correctIndex does not point at the correct answer`);
  }

  if (round.task === 'heading') {
    const order = directionsOrder(round.directions);
    if (round.options.length !== round.directions) {
      problems.push(`heading options count ${round.options.length} != ${round.directions}`);
    }
    for (const o of round.options) {
      if (!order.includes(o as Dir)) {
        problems.push(`heading option ${String(o)} is not a valid direction`);
      }
    }
  } else if (round.options.length !== POSITION_OPTION_COUNT) {
    problems.push(`position options count ${round.options.length} != ${POSITION_OPTION_COUNT}`);
  }

  return problems;
}
