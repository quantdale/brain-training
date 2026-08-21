/**
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   node scripts/generate-game-registry.mjs
 *
 * Sources: game.json files under apps/mobile/src/games/<id>/.
 * Generator version: 1. Deterministic output.
 */
import type { ComponentType } from 'react';
import type { GameDefinition } from '@/sdk';

export const registry: readonly GameDefinition[] = [
  {
    id: "attention-odd-one-out",
    name: "Odd One Out",
    primaryCategory: "Attention",
    secondaryDomains: [
    "Speed"
  ],
    description: "Every board hides exactly one odd item — find it and tap it before the timer runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "attention-symbol-tracker",
    name: "Symbol Tracker",
    primaryCategory: "Attention",
    secondaryDomains: [
    "Memory"
  ],
    description: "Watch which tokens are highlighted, then the board scrambles and adds distractors. Pick out the tokens you were told to track by what they are.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "attention-target-count",
    name: "Target Count",
    primaryCategory: "Attention",
    secondaryDomains: [
    "Speed"
  ],
    description: "A grid briefly shows a mix of symbols. Quickly count how many of the highlighted target symbol appear, then pick the right number. Trains selective attention and numerosity under time pressure.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "attention-visual-search",
    name: "Visual Search",
    primaryCategory: "Attention",
    secondaryDomains: [
    "Speed"
  ],
    description: "Find the odd tile and tap it — fast, before the clock runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "flexibility-card-sort",
    name: "Card Sort",
    primaryCategory: "Flexibility",
    secondaryDomains: [
    "Attention"
  ],
    description: "Match cards by the active rule — the rule keeps switching, so stay flexible.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "flexibility-color-stroop",
    name: "Color Stroop",
    primaryCategory: "Flexibility",
    secondaryDomains: [
    "Attention",
    "Speed"
  ],
    description: "Identify the ink color of color words, tracking rule flips between 'ink' and 'word' modes.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "flexibility-cue-shift",
    name: "Cue Shift",
    primaryCategory: "Flexibility",
    secondaryDomains: [
    "Attention"
  ],
    description: "A rule cue changes every trial — read it, then match the target by color, shape, or number.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "flexibility-rule-flip",
    name: "Rule Flip",
    primaryCategory: "Flexibility",
    secondaryDomains: [
    "Attention"
  ],
    description: "Match the target card by the active rule — color, shape, or number. The rule stays put for a run of trials, then flips without warning; re-anchor fast to keep scoring.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "flexibility-task-switch",
    name: "Task Switch",
    primaryCategory: "Flexibility",
    secondaryDomains: [
    "Attention"
  ],
    description: "Alternate between micro-tasks using the cue. Switching tasks is the challenge — accuracy and switch cost matter more than speed.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "language-context-fit",
    name: "Context Fit",
    primaryCategory: "Language",
    description: "Read a short sentence with a blank and pick the one word that fits the context best.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: null,
    contentVersion: "1.0.0",
    hasTutorial: true,
  },
  {
    id: "language-sentence-builder",
    name: "Sentence Builder",
    primaryCategory: "Language",
    secondaryDomains: [
    "Attention",
    "Speed"
  ],
    description: "Rebuild scrambled sentences by tapping words in the correct order.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: "1.0.0",
    hasTutorial: true,
  },
  {
    id: "language-word-chain",
    name: "Word Chain",
    primaryCategory: "Language",
    secondaryDomains: [
    "Memory"
  ],
    description: "Complete each word chain: every next word starts with the last letter of the one before it. Pick the missing links before time runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: null,
    contentVersion: "1.0.0",
    hasTutorial: true,
  },
  {
    id: "language-word-match",
    name: "Word Match",
    primaryCategory: "Language",
    description: "Pick the word that means the same as the prompt — four options, one perfect match.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: null,
    contentVersion: "2.0.0",
    hasTutorial: true,
  },
  {
    id: "language-word-scramble",
    name: "Word Scramble",
    primaryCategory: "Language",
    secondaryDomains: [
    "Attention"
  ],
    description: "Unscramble the letters to form the correct word using the category hint.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: "1.0.0",
    hasTutorial: true,
  },
  {
    id: "logic-code-cracker",
    name: "Code Cracker",
    primaryCategory: "Logic & Problem Solving",
    secondaryDomains: [
    "Attention"
  ],
    description: "Crack a hidden color code using logic and deduction. Get feedback on each guess to narrow down the solution.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "logic-deduction-table",
    name: "Deduction Table",
    primaryCategory: "Logic & Problem Solving",
    description: "Read a table of entities and a set of clues, then deduce the one value the question asks for before time runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "logic-next-sequence",
    name: "Next in Sequence",
    primaryCategory: "Logic & Problem Solving",
    secondaryDomains: [
    "Math"
  ],
    description: "Spot the pattern in a number sequence, then pick the next term.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "logic-order-path",
    name: "Order Path",
    primaryCategory: "Logic & Problem Solving",
    description: "Use the precedence clues to place every item in the one valid order. Each step has exactly one item that can go next.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "logic-rule-grid",
    name: "Rule Grid",
    primaryCategory: "Logic & Problem Solving",
    secondaryDomains: [
    "Attention"
  ],
    description: "A grid of symbols follows one rule: every row and column contains each symbol exactly once. One cell is blank — deduce the only symbol that can fit. Pure constraint-logic inference.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "math-equation-builder",
    name: "Equation Builder",
    primaryCategory: "Math",
    secondaryDomains: [
    "Logic & Problem Solving"
  ],
    description: "Build an equation using all the given numbers and operators to reach the target number.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.1.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "math-fast-math",
    name: "Fast Math",
    primaryCategory: "Math",
    secondaryDomains: [
    "Speed"
  ],
    description: "Solve arithmetic problems against the clock — every problem is validated to have an exact, non-negative answer.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "math-missing-operator",
    name: "Missing Operator",
    primaryCategory: "Math",
    secondaryDomains: [
    "Logic & Problem Solving"
  ],
    description: "Find the operator that makes the equation true — the numbers grow and the clock shrinks.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "memory",
    name: "Memory",
    primaryCategory: "Memory",
    secondaryDomains: [
    "Attention"
  ],
    description: "Watch the tiles light up in sequence, then repeat the pattern from memory.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "memory-grid-recall",
    name: "Grid Recall",
    primaryCategory: "Memory",
    secondaryDomains: [
    "Attention"
  ],
    description: "Study a pattern of highlighted cells, then rebuild it from memory after the board is hidden. More cells and bigger grids as you improve.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "memory-pattern-tap-back",
    name: "Pattern Tap Back",
    primaryCategory: "Memory",
    secondaryDomains: [
    "Attention"
  ],
    description: "Watch tiles light up in a sequence, then tap them back in the same order.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "memory-running-order",
    name: "Running Order",
    primaryCategory: "Memory",
    secondaryDomains: [
    "Attention"
  ],
    description: "Watch a stream of symbols, then recall the LAST few in order. Older items are just distractors — hold only what matters.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "memory-sequence-memory",
    name: "Sequence Memory",
    primaryCategory: "Memory",
    secondaryDomains: [
    "Attention"
  ],
    description: "Simon-style score attack: watch the pads light up, then repeat the pattern before the clock runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "spatial-coordinate-turn",
    name: "Coordinate Turn",
    primaryCategory: "Spatial",
    secondaryDomains: [
    "Attention",
    "Logic & Problem Solving"
  ],
    description: "Follow relative turn and move instructions, then say which way you end up facing.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "spatial-fold-match",
    name: "Fold Match",
    primaryCategory: "Spatial",
    secondaryDomains: [
    "Logic & Problem Solving"
  ],
    description: "A grid folds along an axis and the two halves merge. Pick the folded result.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "spatial-grid-nav",
    name: "Grid Navigator",
    primaryCategory: "Spatial",
    secondaryDomains: [
    "Attention"
  ],
    description: "A marker sits on a grid facing a direction. Read the move/turn commands and tap the cell where the marker ends up.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "spatial-mental-rotation",
    name: "Mental Rotation",
    primaryCategory: "Spatial",
    secondaryDomains: [
    "Attention"
  ],
    description: "Decide whether the candidate shape is a rotated copy of the target — or a different shape.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "spatial-transform-match",
    name: "Transform Match",
    primaryCategory: "Spatial",
    secondaryDomains: [
    "Logic & Problem Solving"
  ],
    description: "A grid pattern is transformed — pick the correct rotated or mirrored version from the options.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.1.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "speed-color-match",
    name: "Color Match",
    primaryCategory: "Speed",
    secondaryDomains: [
    "Attention"
  ],
    description: "Tap the button matching the swatch color (not the text color) as fast as possible.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "speed-quick-compare",
    name: "Quick Compare",
    primaryCategory: "Speed",
    secondaryDomains: [
    "Attention"
  ],
    description: "Two values, one fast decision: judge whether they match, which is larger, or which side sums to more — before the clock runs out.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "speed-reaction-time",
    name: "Reaction Time",
    primaryCategory: "Speed",
    secondaryDomains: [
    "Attention"
  ],
    description: "Watch for the signal and tap as fast as you can — how quick is your reaction?",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
  {
    id: "speed-tap-rush",
    name: "Tap Rush",
    primaryCategory: "Speed",
    secondaryDomains: [
    "Attention"
  ],
    description: "Targets pop up one at a time — tap each one before its window closes to keep the streak alive.",
    sdkVersion: "0.1.0",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    contentVersion: null,
    hasTutorial: true,
  },
];

/**
 * Lazy loaders from game id to the module that exports the game screen as
 * its default export. The `app/game/[id].tsx` route resolves the screen
 * through this map; games never hand-edit this file.
 */
export const gameScreenLoaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  'attention-odd-one-out': () => import('@/games/attention-odd-one-out'),
  'attention-symbol-tracker': () => import('@/games/attention-symbol-tracker'),
  'attention-target-count': () => import('@/games/attention-target-count'),
  'attention-visual-search': () => import('@/games/attention-visual-search'),
  'flexibility-card-sort': () => import('@/games/flexibility-card-sort'),
  'flexibility-color-stroop': () => import('@/games/flexibility-color-stroop'),
  'flexibility-cue-shift': () => import('@/games/flexibility-cue-shift'),
  'flexibility-rule-flip': () => import('@/games/flexibility-rule-flip'),
  'flexibility-task-switch': () => import('@/games/flexibility-task-switch'),
  'language-context-fit': () => import('@/games/language-context-fit'),
  'language-sentence-builder': () => import('@/games/language-sentence-builder'),
  'language-word-chain': () => import('@/games/language-word-chain'),
  'language-word-match': () => import('@/games/language-word-match'),
  'language-word-scramble': () => import('@/games/language-word-scramble'),
  'logic-code-cracker': () => import('@/games/logic-code-cracker'),
  'logic-deduction-table': () => import('@/games/logic-deduction-table'),
  'logic-next-sequence': () => import('@/games/logic-next-sequence'),
  'logic-order-path': () => import('@/games/logic-order-path'),
  'logic-rule-grid': () => import('@/games/logic-rule-grid'),
  'math-equation-builder': () => import('@/games/math-equation-builder'),
  'math-fast-math': () => import('@/games/math-fast-math'),
  'math-missing-operator': () => import('@/games/math-missing-operator'),
  'memory': () => import('@/games/memory'),
  'memory-grid-recall': () => import('@/games/memory-grid-recall'),
  'memory-pattern-tap-back': () => import('@/games/memory-pattern-tap-back'),
  'memory-running-order': () => import('@/games/memory-running-order'),
  'memory-sequence-memory': () => import('@/games/memory-sequence-memory'),
  'spatial-coordinate-turn': () => import('@/games/spatial-coordinate-turn'),
  'spatial-fold-match': () => import('@/games/spatial-fold-match'),
  'spatial-grid-nav': () => import('@/games/spatial-grid-nav'),
  'spatial-mental-rotation': () => import('@/games/spatial-mental-rotation'),
  'spatial-transform-match': () => import('@/games/spatial-transform-match'),
  'speed-color-match': () => import('@/games/speed-color-match'),
  'speed-quick-compare': () => import('@/games/speed-quick-compare'),
  'speed-reaction-time': () => import('@/games/speed-reaction-time'),
  'speed-tap-rush': () => import('@/games/speed-tap-rush'),
};
