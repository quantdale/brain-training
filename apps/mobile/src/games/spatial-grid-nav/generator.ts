/**
 * Deterministic generation for the Spatial Grid Navigator game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round produces:
 *   1. A start cell + facing direction.
 *   2. A command sequence (forward/back/left/right).
 *   3. The correct final cell (result of simulating the commands).
 *   4. An option set: the correct final cell + plausible distractors.
 *
 * Invariants:
 *   - The marker never leaves the grid for the entire command sequence. We
 *     guarantee this analytically: the command walk is computed from a
 *     hypothetical origin (0,0); its bounding box of offsets tells us exactly
 *     which start cells keep every visited position in bounds. We pick the
 *     start cell inside that safe rectangle, so all positions — including the
 *     final cell — are in bounds. If a generated command sequence's bounding
 *     box does not fit the grid, we regenerate the command sequence
 *     deterministically (bounded attempts), falling back to a no-move
 *     (turn-only) sequence which is always in bounds.
 *   - The correct option equals simulate(start, startDir, commands).
 *   - Options are distinct, in-bounds, and exactly one equals finalCell.
 *   - commandCount is within [minCommandCount, maxCommandCount].
 */
import { createRng } from '@/sdk';
import type { Rng } from '@/sdk';

import { cellsEqual } from './types';
import type { Cell, Command, CommandType, Dir, GeneratedRound, SpatialGridNavDifficultyParams } from './types';

/** Upper bound on command-sequence regeneration attempts before the fallback. */
export const MAX_GENERATE_ATTEMPTS = 12;

/** Maximum number of answer options across difficulties (distractor cap). */
export const CANDIDATE_COUNT = 4;

/** Direction in clockwise order (used for rotation math). */
const DIR_ORDER: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** Row/col delta for one step "forward" in a given direction. */
function dirDelta(dir: Dir): { dr: number; dc: number } {
  switch (dir) {
    case 'N':
      return { dr: -1, dc: 0 };
    case 'E':
      return { dr: 0, dc: 1 };
    case 'S':
      return { dr: 1, dc: 0 };
    case 'W':
      return { dr: 0, dc: -1 };
  }
}

/** Rotate a direction 90° left (counter-clockwise) or right (clockwise). */
export function rotateDir(dir: Dir, turn: 'left' | 'right'): Dir {
  const idx = DIR_ORDER.indexOf(dir);
  const next = turn === 'right' ? (idx + 1) % 4 : (idx + 3) % 4;
  return DIR_ORDER[next];
}

/** True when a cell is within the grid. */
export function inBounds(cell: Cell, side: number): boolean {
  return cell.row >= 0 && cell.row < side && cell.col >= 0 && cell.col < side;
}

/** Simulate a command sequence from a start cell/direction. */
export function simulate(
  start: Cell,
  startDir: Dir,
  commands: readonly Command[],
  side: number,
): { finalCell: Cell; turnCount: number } {
  let row = start.row;
  let col = start.col;
  let dir = startDir;
  let turnCount = 0;
  for (const command of commands) {
    if (command.type === 'left' || command.type === 'right') {
      dir = rotateDir(dir, command.type);
      turnCount += 1;
    } else {
      const step = command.type === 'forward' ? 1 : -1;
      const { dr, dc } = dirDelta(dir);
      row += dr * step;
      col += dc * step;
    }
  }
  void side; // bounding-box guarantee is enforced at generation time
  return { finalCell: { row, col }, turnCount };
}

/** Build a command sequence deterministically from an RNG. */
function buildCommandSequence(
  rng: Rng,
  commandCount: number,
  allowBack: boolean,
  turnFraction: number,
): Command[] {
  const turnTarget = Math.max(
    0,
    Math.min(commandCount, Math.round(turnFraction * commandCount)),
  );
  const slots = Array.from({ length: commandCount }, (_, i) => i);
  const turnSlots = new Set(rng.shuffle(slots).slice(0, turnTarget));
  const commands: Command[] = [];
  for (let i = 0; i < commandCount; i += 1) {
    if (turnSlots.has(i)) {
      commands.push({ type: rng.next() < 0.5 ? 'left' : 'right' });
    } else if (allowBack && rng.next() < 0.5) {
      commands.push({ type: 'back' });
    } else {
      commands.push({ type: 'forward' });
    }
  }
  return commands;
}

/** Compute the offset bounding box of a command walk from origin (0,0). */
function computeWalk(startDir: Dir, commands: readonly Command[]): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  finalRow: number;
  finalCol: number;
  turnCount: number;
} {
  let row = 0;
  let col = 0;
  let dir = startDir;
  let minRow = 0;
  let maxRow = 0;
  let minCol = 0;
  let maxCol = 0;
  let turnCount = 0;
  for (const command of commands) {
    if (command.type === 'left' || command.type === 'right') {
      dir = rotateDir(dir, command.type);
      turnCount += 1;
    } else {
      const step = command.type === 'forward' ? 1 : -1;
      const { dr, dc } = dirDelta(dir);
      row += dr * step;
      col += dc * step;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
    }
  }
  return { minRow, maxRow, minCol, maxCol, finalRow: row, finalCol: col, turnCount };
}

/** Final cell of a (possibly modified) command list from a fixed start. */
function finalCellOf(start: Cell, startDir: Dir, commands: readonly Command[]): Cell {
  return simulate(start, startDir, commands, 0).finalCell;
}

/** Plausible distractors derived from small perturbations of the command list. */
function buildDistractors(
  start: Cell,
  startDir: Dir,
  commands: readonly Command[],
  correct: Cell,
  side: number,
  rng: Rng,
): Cell[] {
  const distractors: Cell[] = [];
  const seen = new Set<string>();
  const key = (c: Cell): string => `${c.row},${c.col}`;

  const tryAdd = (cell: Cell): void => {
    if (!inBounds(cell, side)) return;
    if (cellsEqual(cell, correct)) return;
    const k = key(cell);
    if (seen.has(k)) return;
    seen.add(k);
    distractors.push(cell);
  };

  // 1. Drop the last command.
  if (commands.length > 1) {
    tryAdd(finalCellOf(start, startDir, commands.slice(0, -1)));
  }
  // 2. Drop the first command.
  if (commands.length > 1) {
    tryAdd(finalCellOf(start, startDir, commands.slice(1)));
  }
  // 3. Flip the last turn (if the last command is a turn).
  if (commands.length > 0) {
    const last = commands[commands.length - 1];
    if (last.type === 'left' || last.type === 'right') {
      const flipped: CommandType = last.type === 'left' ? 'right' : 'left';
      const altered = [...commands.slice(0, -1), { type: flipped }];
      tryAdd(finalCellOf(start, startDir, altered));
    }
  }

  // Fill the rest with random in-bound cells (deterministic).
  let guard = 0;
  while (distractors.length < CANDIDATE_COUNT && guard < MAX_GENERATE_ATTEMPTS * 8) {
    const cell: Cell = { row: rng.nextInt(side), col: rng.nextInt(side) };
    tryAdd(cell);
    guard += 1;
  }

  return distractors;
}

/**
 * Generate one round. Deterministic given `rng` and `roundIndex`. Guarantees
 * the marker stays in bounds for the entire command sequence.
 */
export function generateRound(
  rng: Rng,
  params: SpatialGridNavDifficultyParams,
  roundIndex: number,
): GeneratedRound {
  const side = params.gridSide;

  const countRng = rng.fork(`round:${roundIndex}:count`);
  const commandCount = countRng.nextIntRange(params.minCommandCount, params.maxCommandCount + 1);

  const dirRng = rng.fork(`round:${roundIndex}:dir`);
  const startDir = dirRng.pick(DIR_ORDER);

  const turnFracRng = rng.fork(`round:${roundIndex}:turnfrac`);
  const turnFraction = 0.2 + turnFracRng.next() * 0.5;

  let chosen: {
    commands: Command[];
    start: Cell;
    finalCell: Cell;
    turnCount: number;
  } | null = null;

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
    const cmdRng = rng.fork(`round:${roundIndex}:cmds:${attempt}`);
    const commands = buildCommandSequence(cmdRng, commandCount, params.allowBack, turnFraction);
    const walk = computeWalk(startDir, commands);
    const loRow = Math.max(0, -walk.minRow);
    const hiRow = Math.min(side - 1, side - 1 - walk.maxRow);
    const loCol = Math.max(0, -walk.minCol);
    const hiCol = Math.min(side - 1, side - 1 - walk.maxCol);
    if (hiRow >= loRow && hiCol >= loCol) {
      const startRng = rng.fork(`round:${roundIndex}:start:${attempt}`);
      const start: Cell = {
        row: startRng.nextIntRange(loRow, hiRow + 1),
        col: startRng.nextIntRange(loCol, hiCol + 1),
      };
      const finalCell: Cell = {
        row: start.row + walk.finalRow,
        col: start.col + walk.finalCol,
      };
      chosen = { commands, start, finalCell, turnCount: walk.turnCount };
      break;
    }
  }

  if (chosen === null) {
    // Fallback: a turn-only sequence never moves, so it is always in bounds.
    const commands: Command[] = Array.from({ length: commandCount }, (_, i) => ({
      type: i % 2 === 0 ? 'left' : 'right',
    }));
    const walk = computeWalk(startDir, commands);
    const start: Cell = { row: 0, col: 0 };
    const finalCell: Cell = { row: start.row + walk.finalRow, col: start.col + walk.finalCol };
    chosen = { commands, start, finalCell, turnCount: walk.turnCount };
  }

  const { commands, start, finalCell, turnCount } = chosen;

  const distractors = buildDistractors(start, startDir, commands, finalCell, side, rng.fork(`round:${roundIndex}:distractors`));
  const chosenDistractors = distractors.slice(0, Math.max(0, params.options - 1));

  const options: Cell[] = [finalCell, ...chosenDistractors];
  const shuffled = rng.fork(`round:${roundIndex}:options`).shuffle(options);
  const correctIndex = shuffled.findIndex((c) => cellsEqual(c, finalCell));

  return {
    start,
    startDir,
    commands,
    finalCell,
    options: shuffled,
    correctIndex,
    commandCount: commands.length,
    turnCount,
  };
}

/**
 * Generate a full deterministic session plan. The reducer stores this plan so
 * QA force paths and normalization can count hard rounds accurately.
 */
export function generateSession(
  seed: string,
  params: SpatialGridNavDifficultyParams,
): GeneratedRound[] {
  const rng = createRng(seed);
  const rounds: GeneratedRound[] = [];
  for (let i = 0; i < params.rounds; i += 1) {
    rounds.push(generateRound(rng, params, i));
  }
  return rounds;
}

/**
 * Validate a generated round. Returns a list of violation messages (empty =
 * valid). Checks: finalCell equals simulate(start, startDir, commands);
 * options distinct & in-bounds; exactly one correct; correct equals finalCell;
 * turnCount matches.
 */
export function validateRound(round: GeneratedRound, side: number): string[] {
  const problems: string[] = [];
  const sim = simulate(round.start, round.startDir, round.commands, side);
  if (!cellsEqual(sim.finalCell, round.finalCell)) {
    problems.push(`finalCell ${JSON.stringify(round.finalCell)} != simulate ${JSON.stringify(sim.finalCell)}`);
  }
  if (sim.turnCount !== round.turnCount) {
    problems.push(`turnCount ${round.turnCount} != simulate ${sim.turnCount}`);
  }
  const correctCount = round.options.filter((o) => cellsEqual(o, round.finalCell)).length;
  if (correctCount !== 1) {
    problems.push(`expected exactly one correct option, found ${correctCount}`);
  }
  const seen = new Set<string>();
  for (let i = 0; i < round.options.length; i += 1) {
    const o = round.options[i];
    if (!inBounds(o, side)) {
      problems.push(`option ${i} out of bounds: ${JSON.stringify(o)}`);
    }
    const k = `${o.row},${o.col}`;
    if (seen.has(k)) {
      problems.push(`option ${i} duplicates an earlier option`);
    }
    seen.add(k);
  }
  if (round.correctIndex < 0 || round.correctIndex >= round.options.length) {
    problems.push(`correctIndex ${round.correctIndex} out of range`);
  } else if (!cellsEqual(round.options[round.correctIndex], round.finalCell)) {
    problems.push(`correctIndex does not point at finalCell`);
  }
  return problems;
}
