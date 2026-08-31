import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Every catalog game owns its mechanics but shares the same async persistence
 * hazard: a late result from session A must not dispatch into restarted
 * session B. Keep this as a source-level tripwire so a future game migration
 * cannot silently omit the shared identity guard.
 */
describe('catalog session lifecycle guard', () => {
  it('guards every game screen persistence callback by the current session id', () => {
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
    for (const file of screenFiles) {
      expect(readFileSync(file, 'utf8')).toContain('session.isCurrentSession(record.id)');
    }
  });
});
