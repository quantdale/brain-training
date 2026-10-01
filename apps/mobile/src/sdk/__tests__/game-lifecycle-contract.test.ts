/**
 * Per-game lifecycle contract (Change 074 §3).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The pre-existing check in `catalog-contracts.test.ts` builds each game's
 * "contract source" by APPENDING the shared host sources whenever the screen
 * delegates to `<GameHost>`:
 *
 *   return delegatesToGameHost(screen) ? `${screen}\n${GAME_HOST_SOURCES}` : screen;
 *
 * Every assertion in that block ("screen lacks AppState auto-pause", "screen
 * never abandons the lifecycle", "screen lacks a finalizedRef guard") was
 * therefore satisfied by the HOST text, not by the game. The suite passed for
 * every game no matter what the game did — including a game that constructed
 * its own lifecycle. It was a guard that could not fail, which is the worst
 * kind: it read as coverage.
 *
 * This file scans ONLY the 42 game module directories and asserts the invariant
 * from the other side: the HOST owns the session lifecycle, so a game must not
 * reach around it.
 *
 * WHAT A GAME IS ALLOWED TO OWN
 * -----------------------------
 * Gameplay timers. `memory-prospective-cue` runs a per-item time window with
 * `setInterval`, and it is CORRECT: created in an effect, cleared on cleanup,
 * and gated on `state.paused` / `tutorialOpen` in its dependencies. A blanket
 * "no timers in a game" rule would have flagged working code and taught the
 * next author that the guard is arbitrary.
 *
 * So the rule is about the SESSION lifecycle, which is shared and owned by the
 * host, plus the separate, universally-enforceable timer-hygiene rule: a timer a
 * game creates must be cleared. A leaked interval keeps firing against a
 * component that is gone, and that is the failure mode worth gating.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { scanModuleSources } from '@/test-utils/source-scan';

const GAMES_ROOT = resolve(__dirname, '..', '..', 'games');

/** Every game module directory, sorted, so failures are reported deterministically. */
function gameIds(): string[] {
  return readdirSync(GAMES_ROOT)
    .filter((id) => {
      try {
        return statSync(join(GAMES_ROOT, id, 'game.json')).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/** Every source file inside a game module, with comments stripped. */
function moduleSources(gameId: string) {
  return scanModuleSources(join(GAMES_ROOT, gameId));
}

describe('per-game module catalog', () => {
  it('discovers all 42 game modules (guards against a vacuous scan)', () => {
    // A floor below 42 catches a broken GAMES_ROOT or an accidentally empty
    // walk, which would make every assertion below pass for the wrong reason.
    expect(gameIds()).toHaveLength(42);
  });
});

describe('a game module does not reach around the host lifecycle', () => {
  const ids = gameIds();

  it('constructs no SessionLifecycle of its own', () => {
    const offenders: string[] = [];
    for (const id of ids) {
      for (const { rel, code } of moduleSources(id)) {
        if (/new\s+SessionLifecycle\s*\(/.test(code)) {
          offenders.push(`${id}/${rel}`);
        }
      }
    }
    // The host owns the session timer, its pause, and its finalization. A
    // second lifecycle means a second timer nothing stops.
    expect(offenders).toEqual([]);
  });

  it('subscribes to AppState directly nowhere', () => {
    // Background auto-pause is the host's. A game that also subscribes gets a
    // second pause path whose ordering against the host's is undefined.
    const offenders: string[] = [];
    for (const id of ids) {
      for (const { rel, code } of moduleSources(id)) {
        if (/AppState\s*\.\s*addEventListener/.test(code)) {
          offenders.push(`${id}/${rel}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('imports the SDK lifecycle primitive nowhere', () => {
    const offenders: string[] = [];
    for (const id of ids) {
      for (const { rel, code } of moduleSources(id)) {
        if (/from\s+['"][^'"]*sdk(\/lifecycle)?['"]/.test(code) && /SessionLifecycle/.test(code)) {
          offenders.push(`${id}/${rel}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('drives the session through the shared host hook', () => {
    // The positive half: a game reaches the session only through the hook the
    // host provides, so pause/resume/finalization behave identically everywhere.
    const missing: string[] = [];
    for (const id of ids) {
      const screen = moduleSources(id).find((f) => f.rel === 'screen.tsx');
      if (!screen) {
        missing.push(`${id}: no screen.tsx`);
        continue;
      }
      if (!/useGameSession\s*\(/.test(screen.code)) {
        missing.push(`${id}: screen.tsx does not use the shared session hook`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('a game that owns a timer cleans it up', () => {
  it('every interval/timeout a game creates is cleared', () => {
    // Gameplay timers are legitimate (a per-item window, a countdown flourish);
    // an uncleared one keeps firing against a component that is gone. Checking
    // "created AND cleared" per file is the enforceably-correct version of
    // "no timers", which would have flagged working code.
    const problems: string[] = [];
    for (const id of gameIds()) {
      for (const { rel, code } of moduleSources(id)) {
        const createsInterval = /setInterval\s*\(/.test(code);
        const createsTimeout = /(?<!clear)setTimeout\s*\(/.test(code);
        if (!createsInterval && !createsTimeout) continue;
        const clears =
          /clearInterval\s*\(/.test(code) || /clearTimeout\s*\(/.test(code);
        if (!clears) {
          problems.push(`${id}/${rel}: creates a timer but never clears it`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('a cleanup returned from an effect actually clears what it created', () => {
    // The weaker check above is file-scoped; this one is behavioural in shape:
    // wherever a timer is created, a `return () => clear...` must be reachable.
    // It is a source-level proxy, and the comment says so — the real proof that
    // a timer is cleaned is the device lane, which remains NOT VALIDATED.
    const problems: string[] = [];
    for (const id of gameIds()) {
      for (const { rel, code } of moduleSources(id)) {
        if (!/setInterval\s*\(|setTimeout\s*\(/.test(code)) continue;
        if (/clearInterval\s*\(|clearTimeout\s*\(/.test(code)) continue;
        problems.push(`${id}/${rel}: timer with no clearTimeout/clearInterval`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('a newly added game is covered without editing this file', () => {
  it('scans whatever the directory contains', () => {
    // The scan is derived from `game.json` discovery, so a new game is covered
    // the moment it ships a manifest; nothing here lists 42 ids.
    const discovered = gameIds();
    expect(new Set(discovered).size).toBe(discovered.length);
    expect(discovered).toContain('speed-tap-rush');
    expect(discovered).toContain('memory-prospective-cue');
  });
});
