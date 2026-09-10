import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Adaptive contract 006r: the record's structured difficulty must carry the
 * final computed challenge rating, so the rating pipeline never reads the SDK
 * adaptive baseline (0.5). Keep this as a source-level tripwire so a future
 * game migration cannot silently omit the final rating.
 */
describe('catalog adaptive challenge rating wiring', () => {
  it('passes the computed challenge rating into every buildSessionRecord difficulty', () => {
    const gamesDir = resolve(__dirname, '../../../games');
    const screenFiles = readdirSync(gamesDir)
      .map((gameId) => resolve(gamesDir, gameId, 'screen.tsx'))
      .filter((file) => {
        try {
          return readFileSync(file, 'utf8').length > 0;
        } catch {
          return false;
        }
      });

    expect(screenFiles).toHaveLength(42);
    // Matches the canonical one-liner and the multiline variant used by games
    // that persist final adaptive parameters next to the rating.
    const adaptiveDifficulty =
      /difficulty:\s*\{\s*\.\.\.state\.profile,\s*challengeRating\b/;
    for (const file of screenFiles) {
      expect(readFileSync(file, 'utf8')).toMatch(adaptiveDifficulty);
    }
  });
});
