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

];

/**
 * Lazy loaders from game id to the module that exports the game screen as
 * its default export. The `app/game/[id].tsx` route resolves the screen
 * through this map; games never hand-edit this file.
 */
export const gameScreenLoaders: Record<string, () => Promise<{ default: ComponentType }>> = {

};
