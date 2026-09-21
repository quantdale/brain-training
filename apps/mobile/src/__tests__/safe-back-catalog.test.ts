import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase-2 hardening catalog guard (058 follow-up): a game screen may not call
 * a bare `router.back()` on its exit path. A cold deep-link landing
 * (`braintraining://game/<id>`) has an empty navigation stack, so `back()`
 * no-ops and GameHost's hardware-back pause intercept consumes the physical
 * back press — the player is stranded with no way out. Every screen must
 * route its exit through the shared `useSafeBack('/games')` fallback.
 *
 * Source-level tripwire so a future game migration cannot silently
 * reintroduce the bare back (same pattern as `catalog-session-guards`).
 * Lives outside `games/**` because the catalog scanners treat every
 * directory there as a game module.
 */
describe('catalog safe-back guard', () => {
  it('routes every game exit through useSafeBack("/games") with no bare router.back()', () => {
    const gamesDir = resolve(__dirname, '..', 'games');
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
      const source = readFileSync(file, 'utf8');
      // Positive: the shared empty-stack fallback targets the Games library.
      expect(source).toMatch(/useSafeBack\(\s*['"]\/games['"]\s*\)/);
      // Negative: no bare no-op back remains anywhere in the exit path.
      expect(source).not.toMatch(/router\.back\s*\(/);
    }
  });
});
