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
  'attention-visual-search': () => import('@/games/attention-visual-search'),
  'flexibility-card-sort': () => import('@/games/flexibility-card-sort'),
  'language-word-match': () => import('@/games/language-word-match'),
  'logic-next-sequence': () => import('@/games/logic-next-sequence'),
  'math-fast-math': () => import('@/games/math-fast-math'),
  'math-missing-operator': () => import('@/games/math-missing-operator'),
  'memory': () => import('@/games/memory'),
  'memory-sequence-memory': () => import('@/games/memory-sequence-memory'),
  'spatial-mental-rotation': () => import('@/games/spatial-mental-rotation'),
  'speed-reaction-time': () => import('@/games/speed-reaction-time'),
  'speed-tap-rush': () => import('@/games/speed-tap-rush'),
};
