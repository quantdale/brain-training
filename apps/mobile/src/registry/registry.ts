/**
 * Game registry — consumer API for the generated game catalog.
 *
 * The shell (Games screen, `app/game/[id].tsx`) reads games through this
 * module and never touches the generated artifact directly.
 *
 * The `GameDefinition` contract is owned by the Game SDK (`@/sdk`); the
 * generated registry (`registry.generated.ts`) is produced by
 * `node scripts/generate-game-registry.mjs` from each game's `game.json`.
 * It is wired in at startup in `src/app/_layout.tsx`:
 *
 *   import { registry } from '@/registry/registry.generated';
 *   import { registerGameDefinitions } from '@/registry/registry';
 *   registerGameDefinitions(registry);
 */

import { defineGame } from '@/sdk';
import type { GameDefinition } from '@/sdk';

export type { GameCategory, GameDefinition } from '@/sdk';

/** Games currently registered. Starts empty until startup wiring runs. */
let registeredGames: readonly GameDefinition[] = [];

/**
 * Register the game catalog. Called once at startup with the generated
 * registry (see module comment). Every definition is validated through the
 * SDK contract and frozen; an invalid entry throws at startup.
 */
export function registerGameDefinitions(definitions: readonly GameDefinition[]): void {
  registeredGames = definitions.map(defineGame);
}

/** All registered games, in registry order. */
export function getAllGameDefinitions(): readonly GameDefinition[] {
  return registeredGames;
}

/** Look up a game by stable id; `undefined` when not registered. */
export function getGameDefinition(id: string): GameDefinition | undefined {
  return registeredGames.find((game) => game.id === id);
}
