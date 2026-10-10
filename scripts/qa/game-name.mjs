#!/usr/bin/env node
/**
 * 076-f game-sweep helper: print the registry display name for a game id.
 *
 * Used by scripts/qa/cert076f-game-sweep.sh so a harvested controller note can
 * be rejected when it documents a DIFFERENT game. Measured failure: one note
 * carried the correct game id in its own header while every documented state
 * belonged to the previous game, so matching on the id alone accepts the wrong
 * game — the body must name this game's own title.
 *
 * Usage: node scripts/qa/game-name.mjs <gameId>
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const id = process.argv[2];
if (!id) {
  process.stderr.write('usage: node scripts/qa/game-name.mjs <gameId>\n');
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, '..', '..');
const registryPath = path.join(root, 'apps/mobile/src/registry/registry.generated.ts');
const src = readFileSync(registryPath, 'utf8');

// The generator emits one object per game with id and name on adjacent lines.
const re = new RegExp(`id:\\s*"${id}"[\\s\\S]{0,200}?name:\\s*"([^"]+)"`);
const m = re.exec(src);
if (!m) {
  process.stderr.write(`game id not found in registry: ${id}\n`);
  process.exit(1);
}
process.stdout.write(m[1]);
