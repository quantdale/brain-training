/**
 * Rule Flip game — game definition. Single source of truth is game.json;
 * this module parses it through the SDK contract.
 */
import { parseGameDefinitionJson } from '@/sdk';
import type { GameDefinition } from '@/sdk';

import gameJson from './game.json';

export const gameDefinition: Readonly<GameDefinition> = parseGameDefinitionJson(gameJson);
