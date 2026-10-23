#!/usr/bin/env node
/**
 * Source-backed Campaign 080 gameplay policy.
 *
 * Tutorial applicability is read from each shipping game.json. Passive credit
 * is deliberately allowlisted here rather than accepted from ledger fields:
 * the entries below name transitions implemented by each game's reducer.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GAMES_DIR = path.resolve(__dirname, '../../apps/mobile/src/games');

const metadata = new Map();
for (const directory of fs.readdirSync(GAMES_DIR).sort()) {
  const file = path.join(GAMES_DIR, directory, 'game.json');
  if (!fs.existsSync(file)) continue;
  try {
    const game = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof game.id === 'string' && typeof game.hasTutorial === 'boolean') metadata.set(game.id, Object.freeze(game));
  } catch {
    // Invalid metadata is absent; it can never be used to certify a run.
  }
}

export function gameMetadata(gameId) {
  return metadata.get(gameId) || null;
}

/**
 * Only transitions whose reducer semantics are genuinely input-independent.
 * Odd One Out changes to round-failed only after its monotonic round timeout;
 * sequence-memory ends at its session time budget; vigilance advances through
 * its generated stream on trial timers and reaches results after the last slot.
 * Pair Recall and other answer-driven games are intentionally absent.
 */
export const PASSIVE_GAMEPLAY_POLICY = Object.freeze({
  'language-word-chain': Object.freeze({
    roundFailureMarkers: Object.freeze(['round-timeout']),
    terminalOnTimer: false,
  }),
  'attention-odd-one-out': Object.freeze({
    roundFailureMarkers: Object.freeze(['round-failed']),
    terminalOnTimer: false,
  }),
  'memory-sequence-memory': Object.freeze({
    roundFailureMarkers: Object.freeze([]),
    terminalOnTimer: true,
  }),
  'attention-sustained-vigilance': Object.freeze({
    roundFailureMarkers: Object.freeze([]),
    terminalOnTimer: true,
  }),
});

export function passiveGameplayPolicy(gameId) {
  return PASSIVE_GAMEPLAY_POLICY[gameId] || null;
}

export function hasPassiveRoundEvent(gameId, before, after) {
  const policy = passiveGameplayPolicy(gameId);
  if (!policy || !policy.roundFailureMarkers.length) return false;
  const beforeControls = new Set(Array.isArray(before?.controls) ? before.controls : []);
  return policy.roundFailureMarkers.some((marker) =>
    Array.isArray(after?.controls) && after.controls.includes(marker) && !beforeControls.has(marker),
  );
}

export function allowsPassiveTerminal(gameId) {
  return passiveGameplayPolicy(gameId)?.terminalOnTimer === true;
}
