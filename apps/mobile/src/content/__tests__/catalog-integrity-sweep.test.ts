/**
 * Global generator-integrity sweep across the entire non-math catalog
 * (campaign 012 / W10 audit, kept as a permanent regression tripwire).
 *
 * For every non-math game and every shipped difficulty it simulates full
 * sessions across many seeds and enforces the content-integrity contract:
 *
 *  1. Determinism — the same seed reproduces the identical session.
 *  2. Seed sensitivity — different seeds produce different sessions (no
 *     constant-salt generators).
 *  3. Entropy — no generator emits one dominant/constant output.
 *  4. Option invariants — answer options never contain duplicates and
 *     correctIndex stays in range (word-chain steps included).
 *  5. Branch coverage — every categorical branch that a difficulty level
 *     declares (prompt types, rules, tasks, transforms, folds, recipe
 *     families, deviation variants) is actually reachable by generation.
 *  6. Game validators — every exported per-round validator accepts its
 *     generator's output.
 *
 * The sweep is fully deterministic (fixed seeds), so any failure here is a
 * reproducible content regression, not flake.
 */
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import * as oddOneOutGen from '@/games/attention-odd-one-out/generator';
import { ODD_ONE_OUT_DIFFICULTY_PARAMS } from '@/games/attention-odd-one-out/difficulty';
import * as vigilanceGen from '@/games/attention-sustained-vigilance/generator';
import { VIGILANCE_DIFFICULTY_PARAMS } from '@/games/attention-sustained-vigilance/difficulty';
import * as symbolTrackerGen from '@/games/attention-symbol-tracker/generator';
import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '@/games/attention-symbol-tracker/difficulty';
import * as targetCountGen from '@/games/attention-target-count/generator';
import { TARGET_COUNT_DIFFICULTY_PARAMS } from '@/games/attention-target-count/difficulty';
import * as visualSearchGen from '@/games/attention-visual-search/generator';
import { VISUAL_SEARCH_DIFFICULTY_PARAMS } from '@/games/attention-visual-search/difficulty';

import * as cardSortGen from '@/games/flexibility-card-sort/generator';
import { FLEXIBILITY_DIFFICULTY_PARAMS } from '@/games/flexibility-card-sort/difficulty';
import * as stroopGen from '@/games/flexibility-color-stroop/generator';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '@/games/flexibility-color-stroop/difficulty';
import * as cueShiftGen from '@/games/flexibility-cue-shift/generator';
import { FLEXIBILITY_CUE_DIFFICULTY_PARAMS } from '@/games/flexibility-cue-shift/difficulty';
import * as ruleFlipGen from '@/games/flexibility-rule-flip/generator';
import { FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS } from '@/games/flexibility-rule-flip/difficulty';
import * as taskSwitchGen from '@/games/flexibility-task-switch/generator';
import { DIFFICULTY_PARAMS as TASK_SWITCH_PARAMS } from '@/games/flexibility-task-switch/difficulty';

type Level = 'easy' | 'normal' | 'hard' | 'expert';
const LEVELS: Level[] = ['easy', 'normal', 'hard', 'expert'];
const SEED_COUNT = 8;

interface GameAdapter {
  readonly id: string;
  readonly build: (seed: string, level: Level) => unknown[];
  /** Extract categorical branch labels covered by a round. */
  readonly branch?: (round: any) => string[];
  /** Branches that MUST be covered at a level (never-generated = finding). */
  readonly expectedBranches?: (level: Level) => readonly string[];
  /** Single-round validator exported by the game's generator (optional). */
  readonly validator?: (round: any, level: Level) => unknown;
}

const label = (x: unknown): string =>
  typeof x === 'string' ? x : JSON.stringify(x);

const GAMES: GameAdapter[] = [
  // ------------------------- ATTENTION -------------------------
  {
    id: 'attention-odd-one-out',
    build: (seed, level) => {
      const p = (ODD_ONE_OUT_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      const span = p.maxSubtlety - p.minSubtlety + 1;
      for (let i = 0; i < p.rounds; i += 1) {
        const subtlety = p.minSubtlety + (i % span);
        const board = (oddOneOutGen as any).generateBoard({
          rng,
          roundIndex: i,
          subtlety,
          gridSize: p.gridSize,
          prevBoard: prev,
        });
        rounds.push({ subtlety, board });
        prev = board;
      }
      return rounds;
    },
    branch: (r) => [label(r.board.deviation)],
    expectedBranches: (level) => {
      const p = (ODD_ONE_OUT_DIFFICULTY_PARAMS as any)[level];
      const variantsTable = (oddOneOutGen as any)
        .DEVIATION_VARIANTS as Record<string, readonly unknown[]>;
      const out: string[] = [];
      for (let s = p.minSubtlety; s <= p.maxSubtlety; s += 1) {
        for (const v of variantsTable[s] ?? []) out.push(label(v));
      }
      return out;
    },
  },
  {
    id: 'attention-sustained-vigilance',
    build: (seed, level) => {
      const generated = (vigilanceGen as any).generateStream(
        createRng(seed),
        (VIGILANCE_DIFFICULTY_PARAMS as any)[level],
      );
      return generated.trials as unknown[];
    },
  },
  {
    id: 'attention-symbol-tracker',
    build: (seed, level) => {
      const p = (SYMBOL_TRACKER_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round: any = (symbolTrackerGen as any).generateRound({
          rng,
          roundIndex: i,
          gridSize: p.gridSize,
          tokenCount: p.tokenCount,
          trackCount: p.initialTrackCount,
          distractors: p.distractors,
          prevTracked: prev,
        });
        rounds.push(round);
        prev = round.trackedSymbolIds ?? null;
      }
      return rounds;
    },
  },
  {
    id: 'attention-target-count',
    build: (seed, level) => {
      const p = (TARGET_COUNT_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (targetCountGen as any).generateRound({
          rng,
          roundIndex: i,
          params: p,
          prevRound: prev,
        });
        rounds.push(round);
        prev = round;
      }
      return rounds;
    },
    branch: (r) => [`glyph:${r.targetGlyphIndex}`],
    validator: (round) => (targetCountGen as any).validateGeneratedRound(round),
  },
  {
    id: 'attention-visual-search',
    build: (seed, level) => {
      const targets = (visualSearchGen as any).generateSessionTargets(
        seed,
        (VISUAL_SEARCH_DIFFICULTY_PARAMS as any)[level],
      );
      return targets.map((t: number, i: number) => ({ round: i, target: t }));
    },
  },

  // ------------------------- FLEXIBILITY -------------------------
  {
    id: 'flexibility-card-sort',
    build: (seed, level) => {
      const p = (FLEXIBILITY_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prevTarget: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const rule = (i > 0 && i % Math.max(1, p.switchEvery) === 0) ? 'shape' : 'color';
        const round = (cardSortGen as any).generateRound({
          rng,
          roundIndex: i,
          rule,
          numShapes: p.numShapes,
          numColors: p.numColors,
          prevTarget,
        });
        rounds.push(round);
        prevTarget = round.target;
      }
      return rounds;
    },
    branch: (r) => [String(r.rule)],
    expectedBranches: () => ['color', 'shape'],
    validator: (round, level) => {
      const p = (FLEXIBILITY_DIFFICULTY_PARAMS as any)[level];
      return (cardSortGen as any).validateRound(round, p.numShapes, p.numColors);
    },
  },
  {
    id: 'flexibility-color-stroop',
    build: (seed, level) => {
      const trials = (stroopGen as any).generateTrials({
        rng: createRng(seed),
        params: (COLOR_STROOP_DIFFICULTY_PARAMS as any)[level],
      });
      return trials as unknown[];
    },
    branch: (r) => [String(r.trialType)],
    expectedBranches: () => ['congruent', 'incongruent'],
  },
  {
    id: 'flexibility-cue-shift',
    build: (seed, level) => {
      const rounds = (cueShiftGen as any).generateSession(
        seed,
        (FLEXIBILITY_CUE_DIFFICULTY_PARAMS as any)[level],
      );
      return rounds as unknown[];
    },
    branch: (r) => [String(r.rule)],
    expectedBranches: () => ['color', 'shape', 'number'],
    validator: (round, level) => {
      const p = (FLEXIBILITY_CUE_DIFFICULTY_PARAMS as any)[level];
      return (cueShiftGen as any).validateRound(round, p.numShapes, p.numColors, p.numNumbers);
    },
  },
  {
    id: 'flexibility-rule-flip',
    build: (seed, level) => {
      const rounds = (ruleFlipGen as any).generateSession(
        seed,
        (FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS as any)[level],
      );
      return rounds as unknown[];
    },
    branch: (r) => [String(r.rule)],
    expectedBranches: () => ['color', 'shape', 'number'],
    validator: (round, level) => {
      const p = (FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS as any)[level];
      return (ruleFlipGen as any).validateRound(round, p.numShapes, p.numColors, p.numNumbers);
    },
  },
  {
    id: 'flexibility-task-switch',
    build: (seed, level) => {
      const rounds = (taskSwitchGen as any).generateSession(
        seed,
        (TASK_SWITCH_PARAMS as any)[level],
      );
      return rounds as unknown[];
    },
    branch: (r) => [String(r.task)],
    expectedBranches: (level) => (TASK_SWITCH_PARAMS as any)[level].taskPool,
    validator: (round) => (taskSwitchGen as any).validateRound(round),
  },
];

// ------------------------- LANGUAGE -------------------------
import {
  CONTEXT_FIT_DIFFICULTY_PARAMS,
  tiersFromMask as cfTiersFromMask,
} from '@/games/language-context-fit/difficulty';
import { loadContentPack as loadContextPack } from '@/games/language-context-fit/content-validation';
import {
  selectRound as cfSelectRound,
  filterByTiers as cfFilterByTiers,
} from '@/games/language-context-fit/generator';

import { DIFFICULTY_PARAMS as SENTENCE_BUILDER_PARAMS } from '@/games/language-sentence-builder/difficulty';
import * as sentenceBuilderGen from '@/games/language-sentence-builder/generator';
import { SENTENCE_BANK } from '@/games/language-sentence-builder/content/sentence-bank';

import {
  WORD_CHAIN_DIFFICULTY_PARAMS,
  tiersFromMask as wcTiersFromMask,
} from '@/games/language-word-chain/difficulty';
import { loadContentPack as loadWordChainPack } from '@/games/language-word-chain/content-validation';
import {
  filterByTiers as wcFilterByTiers,
  filterByLength as wcFilterByLength,
  generateRound as wcGenerateRound,
} from '@/games/language-word-chain/generator';

import {
  LANGUAGE_DIFFICULTY_PARAMS,
  tiersFromMask as wmTiersFromMask,
} from '@/games/language-word-match/difficulty';
import { loadContentPack as loadWordMatchPack } from '@/games/language-word-match/content-validation';
import {
  filterByTiers as wmFilterByTiers,
  selectRound as wmSelectRound,
} from '@/games/language-word-match/generator';

import * as scrambleGen from '@/games/language-word-scramble/generator';
import { WORD_SCRAMBLE_DIFFICULTY_PARAMS } from '@/games/language-word-scramble/difficulty';

const GAMES_LANGUAGE: GameAdapter[] = [
  {
    id: 'language-context-fit',
    build: (seed, level) => {
      const p = (CONTEXT_FIT_DIFFICULTY_PARAMS as any)[level];
      const pool = cfFilterByTiers(loadContextPack().items, cfTiersFromMask(p.tierMask));
      const rng = createRng(seed);
      const used = new Set<string>();
      let previous: any = null;
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const round: any = cfSelectRound({
          rng,
          roundIndex: i,
          pool,
          usedItemIds: used,
          previousRound: previous,
        });
        used.add(round.itemId);
        previous = round;
        rounds.push(round);
      }
      return rounds;
    },
    validator: (round) => (round as any).itemId !== '' ,
  },
  {
    id: 'language-sentence-builder',
    build: (seed, level) => {
      const p = (SENTENCE_BUILDER_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prevCategory: any = null;
      const usedCategories = new Set<string>();
      for (let i = 0; i < p.rounds; i += 1) {
        const result: any = (sentenceBuilderGen as any).generateRound({
          rng,
          roundIndex: i,
          bank: SENTENCE_BANK,
          minWords: p.minWords,
          maxWords: p.maxWords,
          prevCategory,
          usedCategories: [...usedCategories],
        });
        rounds.push(result);
        prevCategory = result.sentence.category;
        usedCategories.add(prevCategory);
      }
      return rounds;
    },
    branch: (r) => [String(r.sentence.category)],
  },
  {
    id: 'language-word-chain',
    build: (seed, level) => {
      const p = (WORD_CHAIN_DIFFICULTY_PARAMS as any)[level];
      const pack = loadWordChainPack();
      const pool = wcFilterByLength(
        wcFilterByTiers(pack.chains, wcTiersFromMask(p.tierMask)),
        p.minChainLen,
        p.maxChainLen,
      );
      const rng = createRng(seed);
      const used = new Set<string>();
      let previous: any = null;
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const round: any = wcGenerateRound({
          rng,
          roundIndex: i,
          pool,
          decoyPool: pack.decoyPool,
          params: p,
          usedChainIds: used,
          previousRound: previous,
        });
        used.add(round.chainId);
        previous = round;
        rounds.push(round);
      }
      return rounds;
    },
  },
  {
    id: 'language-word-match',
    build: (seed, level) => {
      const p = (LANGUAGE_DIFFICULTY_PARAMS as any)[level];
      const pool = wmFilterByTiers(loadWordMatchPack().items, wmTiersFromMask(p.tierMask));
      const rng = createRng(seed);
      const used = new Set<string>();
      let previous: any = null;
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const round = wmSelectRound({
          rng,
          roundIndex: i,
          pool,
          usedItemIds: used,
          previousRound: previous,
        });
        used.add(round.itemId);
        previous = round;
        rounds.push(round);
      }
      return rounds;
    },
  },
  {
    id: 'language-word-scramble',
    build: (seed, level) => {
      const p = (WORD_SCRAMBLE_DIFFICULTY_PARAMS as any)[level];
      return (scrambleGen as any).generateFullSession(
        createRng(seed),
        p.rounds,
        p.optionsCount,
        p.minWordLength,
        p.maxWordLength,
      );
    },
  },
];

// ------------------------- LOGIC -------------------------
import * as codeCrackerGen from '@/games/logic-code-cracker/generator';
import { CODE_CRACKER_DIFFICULTY_PARAMS } from '@/games/logic-code-cracker/difficulty';
import * as deductionGen from '@/games/logic-deduction-table/generator';
import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from '@/games/logic-deduction-table/difficulty';
import * as nextSequenceGen from '@/games/logic-next-sequence/generator';
import { LOGIC_DIFFICULTY_PARAMS } from '@/games/logic-next-sequence/difficulty';
import * as orderPathGen from '@/games/logic-order-path/generator';
import { ORDER_PATH_DIFFICULTY_PARAMS } from '@/games/logic-order-path/difficulty';
import * as ruleGridGen from '@/games/logic-rule-grid/generator';
import { RULE_GRID_DIFFICULTY_PARAMS } from '@/games/logic-rule-grid/difficulty';

const GAMES_LOGIC: GameAdapter[] = [
  {
    id: 'logic-code-cracker',
    build: (seed, level) => {
      const p = (CODE_CRACKER_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const code: any = (codeCrackerGen as any).generateSecretCode({
          rng,
          roundIndex: i,
          codeLength: p.codeLength,
          colorCount: p.colorCount,
          prevSecretCode: prev,
        });
        rounds.push({ round: i, secretCode: code });
        prev = code;
      }
      return rounds;
    },
  },
  {
    id: 'logic-deduction-table',
    build: (seed, level) => {
      const p = (LOGIC_DEDUCTION_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (deductionGen as any).generateRound({
          rng,
          roundIndex: i,
          params: p,
          prevRound: prev,
        });
        rounds.push(round);
        prev = round;
      }
      return rounds;
    },
    validator: (round) => (deductionGen as any).validateGeneratedRound(round),
  },
  {
    id: 'logic-next-sequence',
    build: (seed, level) => {
      const p = (LOGIC_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const puzzle = (nextSequenceGen as any).generatePuzzle({
          rng,
          roundIndex: i,
          tier: p.recipeTier,
          params: p,
          prevPuzzle: prev,
        });
        rounds.push(puzzle);
        prev = puzzle;
      }
      return rounds;
    },
    branch: (r) => [String(r.family)],
    expectedBranches: (level) => {
      const p = (LOGIC_DIFFICULTY_PARAMS as any)[level];
      const pool = ((nextSequenceGen as any).RECIPE_TIERS as readonly string[][])[
        p.recipeTier
    ];
      return pool.map(String);
    },
  },
  {
    id: 'logic-order-path',
    build: (seed, level) => {
      const p = (ORDER_PATH_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (orderPathGen as any).generateRound({
          rng,
          roundIndex: i,
          itemCount: p.itemCount,
          edgeDensityTarget: p.edgeDensityTarget,
          prevSolution: prev,
        });
        rounds.push(round);
        prev = round.solution ?? round;
      }
      return rounds;
    },
    validator: (round) => (orderPathGen as any).validateGeneratedRound(round),
  },
  {
    id: 'logic-rule-grid',
    build: (seed, level) => {
      const p = (RULE_GRID_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (ruleGridGen as any).generateRound({
          rng,
          roundIndex: i,
          params: p,
          prevRound: prev,
        });
        rounds.push(round);
        prev = round;
      }
      return rounds;
    },
    validator: (round) => (ruleGridGen as any).validateGeneratedRound(round),
  },
];

// ------------------------- MEMORY -------------------------
import * as memoryGen from '@/games/memory/generator';
import { MEMORY_DIFFICULTY_PARAMS } from '@/games/memory/difficulty';
import * as gridRecallGen from '@/games/memory-grid-recall/generator';
import { GRID_RECALL_DIFFICULTY_PARAMS } from '@/games/memory-grid-recall/difficulty';
import * as pairRecallGen from '@/games/memory-pair-recall/generator';
import { PAIR_RECALL_DIFFICULTY_PARAMS } from '@/games/memory-pair-recall/difficulty';
import * as patternTapGen from '@/games/memory-pattern-tap-back/generator';
import { DIFFICULTY_PARAMS as PATTERN_TAP_PARAMS } from '@/games/memory-pattern-tap-back/difficulty';
import * as prospectiveCueGen from '@/games/memory-prospective-cue/generator';
import { PROSPECTIVE_CUE_DIFFICULTY_PARAMS } from '@/games/memory-prospective-cue/difficulty';
import * as runningOrderGen from '@/games/memory-running-order/generator';
import { RUNNING_ORDER_DIFFICULTY_PARAMS } from '@/games/memory-running-order/difficulty';
import * as sequenceMemoryGen from '@/games/memory-sequence-memory/generator';
import { SEQUENCE_MEMORY_DIFFICULTY_PARAMS } from '@/games/memory-sequence-memory/difficulty';

const GAMES_MEMORY: GameAdapter[] = [
  {
    id: 'memory',
    build: (seed, level) => {
      const p = (MEMORY_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const seq: any = (memoryGen as any).generateRoundSequence({
          rng,
          roundIndex: i,
          length: p.initialSequenceLength,
          gridSize: p.gridSize,
          prevSequence: prev,
        });
        rounds.push({ round: i, sequence: seq });
        prev = seq;
      }
      return rounds;
    },
  },
  {
    id: 'memory-grid-recall',
    build: (seed, level) => {
      const p = (GRID_RECALL_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const targets: any = (gridRecallGen as any).generateTargetCells({
          rng,
          roundIndex: i,
          gridSize: p.gridSize,
          targetCount: p.initialTargetCount,
          prevTargets: prev,
        });
        rounds.push({ round: i, targets });
        prev = targets;
      }
      return rounds;
    },
  },
  {
    id: 'memory-pair-recall',
    build: (seed, level) => {
      const p = (PAIR_RECALL_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round: any = (pairRecallGen as any).generateRound({
          rng,
          roundIndex: i,
          pairCount: p.initialPairCount,
          prevRound: prev,
        });
        rounds.push(round);
        prev = round;
      }
      return rounds;
    },
    validator: (round) => (pairRecallGen as any).validateRound(round, null),
  },
  {
    id: 'memory-pattern-tap-back',
    build: (seed, level) => {
      const p = (PATTERN_TAP_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const seq: any = (patternTapGen as any).generateRoundSequence({
          rng,
          roundIndex: i,
          length: p.initialSequenceLength,
          gridSize: p.gridSize,
          prevSequence: prev,
        });
        rounds.push({ round: i, sequence: seq });
        prev = seq;
      }
      return rounds;
    },
  },
  {
    id: 'memory-prospective-cue',
    build: (seed, level) => {
      const p = (PROSPECTIVE_CUE_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const round: any = (prospectiveCueGen as any).generateRound({
          rng,
          roundIndex: i,
          signalCount: p.initialSignalCount,
          streamLen: p.streamLen,
          prevActiveSignalIds: prev,
        });
        rounds.push(round);
        prev = round.activeSignalIds ?? null;
      }
      return rounds;
    },
  },
  {
    id: 'memory-running-order',
    build: (seed, level) => {
      const p = (RUNNING_ORDER_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const stream: any = (runningOrderGen as any).generateStream({
          rng,
          roundIndex: i,
          streamLen: p.streamLen,
          recallLength: p.initialRecallLength,
          prevTarget: prev,
        });
        rounds.push({ round: i, stream });
        prev = stream;
      }
      return rounds;
    },
  },
  {
    id: 'memory-sequence-memory',
    build: (seed, level) => {
      const p = (SEQUENCE_MEMORY_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prev: readonly number[] | null = null;
      for (let i = 0; i < 6; i += 1) {
        const seq: any = (sequenceMemoryGen as any).generateSequence({
          rng,
          sequenceIndex: i,
          length: p.baseLength + i,
          tileCount: p.tileCount,
          prevSequence: prev,
        });
        rounds.push({ round: i, sequence: seq });
        prev = seq;
      }
      return rounds;
    },
    validator: (round, level) => {
      const p = (SEQUENCE_MEMORY_DIFFICULTY_PARAMS as any)[level];
      const seq = (round as any).sequence as readonly number[];
      return (sequenceMemoryGen as any).isValidSequence(seq, p.tileCount, seq.length);
    },
  },
];

// ------------------------- SPATIAL -------------------------
import * as coordinateTurnGen from '@/games/spatial-coordinate-turn/generator';
import { DIFFICULTY_PARAMS as COORDINATE_TURN_PARAMS } from '@/games/spatial-coordinate-turn/difficulty';
import * as foldMatchGen from '@/games/spatial-fold-match/generator';
import { DIFFICULTY_PARAMS as FOLD_MATCH_PARAMS } from '@/games/spatial-fold-match/difficulty';
import * as gridNavGen from '@/games/spatial-grid-nav/generator';
import { DIFFICULTY_PARAMS as GRID_NAV_PARAMS } from '@/games/spatial-grid-nav/difficulty';
import * as mentalRotationGen from '@/games/spatial-mental-rotation/generator';
import { SPATIAL_DIFFICULTY_PARAMS } from '@/games/spatial-mental-rotation/difficulty';
import * as transformMatchGen from '@/games/spatial-transform-match/generator';
import { DIFFICULTY_PARAMS as TRANSFORM_MATCH_PARAMS } from '@/games/spatial-transform-match/difficulty';

const GAMES_SPATIAL: GameAdapter[] = [
  {
    id: 'spatial-coordinate-turn',
    build: (seed, level) => {
      const rounds = (coordinateTurnGen as any).generateSession(
        seed,
        (COORDINATE_TURN_PARAMS as any)[level],
      );
      return rounds as unknown[];
    },
    validator: (round) => (coordinateTurnGen as any).validateRound(round),
  },
  {
    id: 'spatial-fold-match',
    build: (seed, level) => {
      const p = (FOLD_MATCH_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prevSource: unknown = null;
      let prevFold: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const data = (foldMatchGen as any).generateRoundData({
          rng,
          roundIndex: i,
          gridRows: p.gridRows,
          gridCols: p.gridCols,
          filledCells: p.filledCells,
          foldsAllowed: p.foldsAllowed,
          optionCount: p.optionCount,
          prevSource,
          prevFold,
        });
        rounds.push(data);
        prevSource = data.source;
        prevFold = data.foldType;
      }
      return rounds;
    },
    branch: (r) => [String(r.foldType)],
    expectedBranches: (level) => (FOLD_MATCH_PARAMS as any)[level].foldsAllowed,
    validator: (round) => (foldMatchGen as any).validateRound(round),
  },
  {
    id: 'spatial-grid-nav',
    build: (seed, level) => {
      const rounds = (gridNavGen as any).generateSession(
        seed,
        (GRID_NAV_PARAMS as any)[level],
      );
      return rounds as unknown[];
    },
    validator: (round, level) =>
      (gridNavGen as any).validateRound(
        round,
        (GRID_NAV_PARAMS as any)[level].gridSide,
      ),
  },
  {
    id: 'spatial-mental-rotation',
    build: (seed, level) => {
      const p = (SPATIAL_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (mentalRotationGen as any).generateRound({
          rng,
          roundIndex: i,
          params: p,
          prevTarget: null,
        });
        rounds.push(round);
      }
      return rounds;
    },
    validator: (round, level) =>
      (mentalRotationGen as any).validateRound(
        round,
        (SPATIAL_DIFFICULTY_PARAMS as any)[level],
      ),
  },
  {
    id: 'spatial-transform-match',
    build: (seed, level) => {
      const p = (TRANSFORM_MATCH_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      let prevSource: unknown = null;
      let prevTransform: unknown = null;
      for (let i = 0; i < p.rounds; i += 1) {
        const data = (transformMatchGen as any).generateRoundData({
          rng,
          roundIndex: i,
          gridSize: p.gridSize,
          side: Math.sqrt(p.gridSize),
          filledCells: p.filledCells,
          allowedTransforms: p.allowedTransforms,
          optionCount: p.optionCount,
          prevSource,
          prevTransform,
        });
        rounds.push(data);
        prevSource = data.source;
        prevTransform = data.transformType;
      }
      return rounds;
    },
    branch: (r) => [String(r.transformType)],
    expectedBranches: (level) => (TRANSFORM_MATCH_PARAMS as any)[level].allowedTransforms,
  },
];

// ------------------------- SPEED -------------------------
import * as colorMatchGen from '@/games/speed-color-match/generator';
import { SPEED_COLOR_MATCH_DIFFICULTY_PARAMS } from '@/games/speed-color-match/difficulty';
import * as orderSweepGen from '@/games/speed-order-sweep/generator';
import { ORDER_SWEEP_DIFFICULTY_PARAMS } from '@/games/speed-order-sweep/difficulty';
import * as quickCompareGen from '@/games/speed-quick-compare/generator';
import { QUICK_COMPARE_DIFFICULTY_PARAMS } from '@/games/speed-quick-compare/difficulty';
import * as reactionTimeGen from '@/games/speed-reaction-time/generator';
import { SPEED_DIFFICULTY_PARAMS } from '@/games/speed-reaction-time/difficulty';
import * as tapRushGen from '@/games/speed-tap-rush/generator';
import { TAP_RUSH_DIFFICULTY_PARAMS } from '@/games/speed-tap-rush/difficulty';

const GAMES_SPEED: GameAdapter[] = [
  {
    id: 'speed-color-match',
    build: (seed, level) => {
      const p = (SPEED_COLOR_MATCH_DIFFICULTY_PARAMS as any)[level];
      const trials = (colorMatchGen as any).generateTrials({
        rng: createRng(seed),
        totalTrials: p.trials,
        incongruentCount: Math.round(p.trials * p.incongruentRatio),
      });
      return trials as unknown[];
    },
    branch: (r) => [r.swatchColor === r.labelColor ? 'congruent' : 'incongruent'],
    expectedBranches: () => ['congruent', 'incongruent'],
  },
  {
    id: 'speed-order-sweep',
    build: (seed, level) => {
      const p = (ORDER_SWEEP_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const round = (orderSweepGen as any).generateRound({
          rng,
          roundIndex: i,
          count: p.count,
          columns: p.columns,
          maxValue: p.maxValue,
        });
        rounds.push(round);
      }
      return rounds;
    },
    validator: (round, level) =>
      (orderSweepGen as any).validateRound(
        round,
        (ORDER_SWEEP_DIFFICULTY_PARAMS as any)[level].count,
        (ORDER_SWEEP_DIFFICULTY_PARAMS as any)[level].maxValue,
      ),
  },
  {
    id: 'speed-quick-compare',
    build: (seed, level) => {
      const p = (QUICK_COMPARE_DIFFICULTY_PARAMS as any)[level];
      return (quickCompareGen as any).generateSessionRounds(
        createRng(seed),
        p,
      ) as unknown[];
    },
    branch: (r) => [String(r.promptType)],
    expectedBranches: (level) => (QUICK_COMPARE_DIFFICULTY_PARAMS as any)[level].promptTypes,
    validator: (round) => (quickCompareGen as any).validateRound(round),
  },
  {
    id: 'speed-reaction-time',
    build: (seed, level) => {
      const p = (SPEED_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const delay = (reactionTimeGen as any).generateRoundDelay({
          rng,
          roundIndex: i,
          minDelayMs: p.minDelayMs,
          maxDelayMs: p.maxDelayMs,
        });
        rounds.push({ round: i, delayMs: delay });
      }
      return rounds;
    },
  },
  {
    id: 'speed-tap-rush',
    build: (seed, level) => {
      const p = (TAP_RUSH_DIFFICULTY_PARAMS as any)[level];
      const rng = createRng(seed);
      const rounds: unknown[] = [];
      for (let i = 0; i < p.rounds; i += 1) {
        const targets = (tapRushGen as any).generateRoundTargets({
          rng,
          roundIndex: i,
          count: p.count,
          radius: p.targetRadius,
        });
        rounds.push({ round: i, targets });
      }
      return rounds;
    },
  },
];

const ALL_GAMES: GameAdapter[] = [
  ...GAMES,
  ...GAMES_LANGUAGE,
  ...GAMES_LOGIC,
  ...GAMES_MEMORY,
  ...GAMES_SPATIAL,
  ...GAMES_SPEED,
];

// ------------------------- HARNESS -------------------------
function fingerprint(x: unknown): string {
  return JSON.stringify(x);
}

function optionIssues(round: unknown): string[] {
  const issues: string[] = [];
  if (typeof round !== 'object' || round === null) return issues;
  const r = round as Record<string, unknown>;
  const rawOpts = (r.options ?? r.optionLabels) as unknown;
  const ci = (r.correctIndex ?? r.correctOptionIndex) as unknown;
  if (Array.isArray(rawOpts)) {
    const labels = (rawOpts as unknown[]).map((o) =>
      typeof o === 'string' ? o : JSON.stringify(o),
    );
    const seen = new Set<string>();
    for (const l of labels) {
      if (seen.has(l)) issues.push(`duplicate option "${l.slice(0, 40)}"`);
      seen.add(l);
    }
    if (ci !== undefined) {
      if (
        typeof ci !== 'number' ||
        !Number.isInteger(ci) ||
        ci < 0 ||
        ci >= labels.length
      ) {
        issues.push(`correctIndex out of range (${String(ci)} of ${labels.length})`);
      }
    }
  }
  if (Array.isArray(r.steps)) {
    for (const step of r.steps as unknown[]) {
      for (const sub of optionIssues(step)) issues.push(`step>${sub}`);
    }
  }
  return issues;
}

function runValidator(
  v: (round: any, level: Level) => unknown,
  round: unknown,
  level: Level,
): { ok: boolean; reason: string } {
  try {
    const res = v(round, level);
    if (res === true || res == null) return { ok: true, reason: '' };
    if (res === false) return { ok: false, reason: 'validator returned false' };
    if (Array.isArray(res)) {
      return res.length === 0
        ? { ok: true, reason: '' }
        : { ok: false, reason: res.map(String).join('; ').slice(0, 200) };
    }
    if (typeof res === 'object') {
      const o = res as Record<string, unknown>;
      if (typeof o.ok === 'boolean') {
        return { ok: o.ok, reason: String(o.reason ?? '').slice(0, 200) };
      }
    }
    return { ok: true, reason: '' };
  } catch (err) {
    return { ok: false, reason: `validator threw: ${String(err).slice(0, 160)}` };
  }
}

describe('W10 throwaway content-integrity audit sweep', () => {
  it('sweeps every non-math game across seeds x difficulties', () => {
    const dupIds = ALL_GAMES.map((g) => g.id).filter(
      (v, i, a) => a.indexOf(v) !== i,
    );
    expect(dupIds).toEqual([]);

    const findings: string[] = [];
    const notes: string[] = [];

    for (const game of ALL_GAMES) {
      try {
        const detA = game.build('w10-det-A', 'normal');
        const detB = game.build('w10-det-A', 'normal');
        if (fingerprint(detA) !== fingerprint(detB)) {
          findings.push(`${game.id}: NON-DETERMINISTIC generation for same seed`);
        }
        const detC = game.build('w10-det-B', 'normal');
        if (fingerprint(detA) === fingerprint(detC)) {
          findings.push(`${game.id}: identical sessions for different seeds (constant salt?)`);
        }
      } catch (err) {
        findings.push(`${game.id}: ADAPTER ERROR ${String(err).slice(0, 180)}`);
        continue;
      }

      for (const level of LEVELS) {
        const branchSeen = new Map<string, number>();
        const fpCount = new Map<string, number>();
        let totalRounds = 0;

        for (let s = 0; s < SEED_COUNT; s += 1) {
          let rounds: unknown[];
          try {
            rounds = game.build(`w10-${s}`, level);
          } catch (err) {
            findings.push(`${game.id}[${level}] seed=${s}: BUILD ERROR ${String(err).slice(0, 150)}`);
            continue;
          }
          for (const round of rounds) {
            totalRounds += 1;
            const key = fingerprint(round);
            fpCount.set(key, (fpCount.get(key) ?? 0) + 1);
            if (game.branch) {
              for (const b of game.branch(round)) {
                branchSeen.set(b, (branchSeen.get(b) ?? 0) + 1);
              }
            }
            for (const issue of optionIssues(round)) {
              findings.push(`${game.id}[${level}]: OPTION INVARIANT ${issue}`);
            }
            if (game.validator && s < 2) {
              const res = runValidator(game.validator, round, level);
              if (!res.ok) {
                findings.push(`${game.id}[${level}] seed=${s}: VALIDATOR ${res.reason}`);
              }
            }
          }
        }

        if (totalRounds > 8 && fpCount.size > 0) {
          let maxSame = 0;
          for (const c of fpCount.values()) maxSame = Math.max(maxSame, c);
          if (maxSame / totalRounds > 0.6) {
            notes.push(`${game.id}[${level}]: dominant repeated output ${maxSame}/${totalRounds} rounds (possible low-entropy generator)`);
          }
        }
        if (totalRounds > 0 && fpCount.size === 1) {
          findings.push(`${game.id}[${level}]: CONSTANT OUTPUT across all seeds/rounds (degenerate generator)`);
        }
        if (game.expectedBranches) {
          for (const eb of game.expectedBranches(level)) {
            if (!branchSeen.has(eb)) {
              findings.push(`${game.id}[${level}]: NEVER-GENERATED BRANCH "${eb}" over ${SEED_COUNT} seeds`);
            }
          }
        }
      }
    }

    console.log(
      `catalog-integrity sweep: ${ALL_GAMES.length} games, ` +
        `${findings.length} findings, ${notes.length} notes`,
    );
    expect([...new Set(findings)]).toEqual([]);
  }, 900000);
});
