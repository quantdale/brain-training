/**
 * Fast Math game — game definition.
 *
 * Single source of truth is `game.json` (the registry generator validates the
 * same file); this module parses it through the SDK contract and exports the
 * frozen `GameDefinition` the game screen and callers use.
 */
import { parseGameDefinitionJson } from '@/sdk';
import type { GameDefinition } from '@/sdk';

import gameJson from './game.json';

export const gameDefinition: Readonly<GameDefinition> = parseGameDefinitionJson(gameJson);
