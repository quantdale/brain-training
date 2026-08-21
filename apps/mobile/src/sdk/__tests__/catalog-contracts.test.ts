/**
 * Catalog-wide platform contracts (campaign 009 — game platform quality).
 *
 * These tests scan every game module under `src/games/**` as PLAIN SOURCE
 * (files are read, never imported, so game internals stay free to change)
 * and enforce the shared conventions every game inherits from the SDK
 * (`@/sdk`) and the shared UI primitives (`@/components/game-ui`).
 *
 * A new game that violates any convention fails here with a message naming
 * the offending file — this is the regression net for:
 *   - session lifecycle: SessionLifecycle driven, auto-pause on background,
 *     abandon on quit, double-submit guard on finalization
 *   - pause contract: shared opaque PauseOverlay + challenge hidden from the
 *     accessibility tree while paused
 *   - QA contract: force hooks behind assertDevOnly(), panel behind
 *     isDevBuild(), panel built on QaPanelShell
 *   - testID convention: every semantic id flows through `testId()` (no raw
 *     `testID="..."` literals outside __tests__ fixtures)
 *   - tutorial lifecycle: createTutorialLifecycle() wiring + stable
 *     `<gameId>.tutorial` testID
 *   - persistence: diagnostics metadata + dbSessionPersister seam +
 *     versions.ts provenance helpers
 *   - adaptive difficulty: every difficulty mapping handles 'adaptive'
 *   - sensory vocabulary: every playSfx/feedback sound literal resolves to a
 *     canonical asset name (identity or SFX_ALIASES) and every haptic literal
 *     is a valid HapticType — catches unaliased sfx names that would silently
 *     play nothing in production.
 */
import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { FEEDBACK_EVENT_MAP, SFX_ALIASES } from '../audio-haptics';
import { parseGameDefinitionJson } from '../types/game-definition';
import type { GameDefinition } from '../types/game-definition';

/** apps/mobile/src/games — resolved relative to this file. */
const GAMES_ROOT = join(__dirname, '..', '..', 'games');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

/** Canonical sound assets bundled by the production engine (see AudioHapticsProvider). */
const CANONICAL_SFX: ReadonlySet<string> = new Set(
  Object.values(FEEDBACK_EVENT_MAP).map((mapped) => mapped.sfx),
);

/** Valid `HapticType` values (union in audio-haptics.ts; no runtime list exists). */
const HAPTIC_TYPES: ReadonlySet<string> = new Set([
  'light',
  'medium',
  'heavy',
  'success',
  'warning',
  'error',
]);

interface GameSource {
  /** Directory name (= expected game id). */
  readonly id: string;
  /** Absolute directory path. */
  readonly path: string;
  /** Source file contents keyed by repo-relative path (`<game>/screen.tsx`). */
  readonly files: ReadonlyMap<string, string>;
}

function listGameDirs(): string[] {
  return readdirSync(GAMES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Read all non-test source files of one game into a map (relative paths). */
function readGameSources(gamePath: string): Map<string, string> {
  const files = new Map<string, string>();
  const visit = (relative: string): void => {
    const segments = relative.split('/');
    if (segments.includes('__tests__')) {
      return; // test fixtures may use raw string ids / arbitrary helpers
    }
    const absolute = join(gamePath, relative);
    if (statSync(absolute).isDirectory()) {
      for (const entry of readdirSync(absolute)) {
        visit(`${relative}/${entry}`);
      }
      return;
    }
    if (SOURCE_EXTENSIONS.has(relative.slice(relative.lastIndexOf('.')))) {
      files.set(relative, readFileSync(absolute, 'utf8'));
    }
  };
  for (const entry of readdirSync(gamePath)) {
    visit(entry);
  }
  return files;
}

function loadCatalog(): GameSource[] {
  return listGameDirs().map((id) => ({
    id,
    path: join(GAMES_ROOT, id),
    files: readGameSources(join(GAMES_ROOT, id)),
  }));
}

const CATALOG = loadCatalog();

/** Every violation as `<file>: <problem>` so failures point at the fix. */
function collectViolations(check: (game: GameSource) => string[]): void {
  const violations: string[] = [];
  for (const game of CATALOG) {
    violations.push(...check(game).map((problem) => `${game.id}: ${problem}`));
  }
  expect(violations).toEqual([]);
}

function requireFile(game: GameSource, file: string): string {
  const content = game.files.get(file);
  expect(content).toBeDefined();
  return content ?? '';
}

describe('catalog sanity', () => {
  it('discovers the full game catalog (guards against vacuous scans)', () => {
    // The catalog ships 36 games; a floor well below that catches a broken
    // GAMES_ROOT resolution or an accidental scan of an empty tree.
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
  });
});

describe('game.json metadata contracts', () => {
  it('every game.json parses through parseGameDefinitionJson with id === dir name', () => {
    collectViolations((game) => {
      const jsonPath = join(game.path, 'game.json');
      if (!existsSync(jsonPath)) {
        return ['game.json: missing game.json'];
      }
      const problems: string[] = [];
      try {
        const json = JSON.parse(readFileSync(join(game.path, 'game.json'), 'utf8'));
        const definition: GameDefinition = parseGameDefinitionJson(json);
        if (definition.id !== game.id) {
          problems.push(`game.json id "${definition.id}" !== directory name "${game.id}"`);
        }
        if (!definition.hasTutorial) {
          problems.push('game.json hasTutorial must be true (first-play tutorial is mandatory)');
        }
      } catch (error) {
        problems.push(`game.json invalid: ${String(error)}`);
      }
      return problems;
    });
  });
});

describe('session lifecycle contracts (every screen)', () => {
  it('drives SessionLifecycle, auto-pauses on background, abandons on quit', () => {
    collectViolations((game) => {
      const screen = requireFile(game, 'screen.tsx');
      const problems: string[] = [];
      if (!/new\s+SessionLifecycle/.test(screen)) {
        problems.push('screen.tsx never constructs SessionLifecycle');
      }
      if (!/AppState\.addEventListener/.test(screen)) {
        problems.push('screen.tsx lacks AppState auto-pause on backgrounding');
      }
      if (!/\.abandon\(\)/.test(screen)) {
        problems.push('screen.tsx never abandons the lifecycle on quit');
      }
      return problems;
    });
  });

  it('guards result finalization against double submission', () => {
    collectViolations((game) => {
      const screen = requireFile(game, 'screen.tsx');
      if (!/finalizedRef/.test(screen)) {
        return ['screen.tsx lacks a finalizedRef double-submit guard'];
      }
      return [];
    });
  });

  it('hides the challenge from the accessibility tree while paused', () => {
    collectViolations((game) => {
      const screen = requireFile(game, 'screen.tsx');
      const problems: string[] = [];
      if (!/accessibilityElementsHidden/.test(screen)) {
        problems.push('screen.tsx does not set accessibilityElementsHidden while paused');
      }
      if (!/importantForAccessibility/.test(screen)) {
        problems.push('screen.tsx does not set importantForAccessibility="no-hide-descendants" while paused');
      }
      return problems;
    });
  });
});

describe('shared component delegation', () => {
  it('pause overlay re-exports the shared PauseOverlay primitive', () => {
    collectViolations((game) => {
      const overlay = requireFile(game, 'components/pause-overlay.tsx');
      const problems: string[] = [];
      if (!/@\/components\/game-ui/.test(overlay)) {
        problems.push('components/pause-overlay.tsx must delegate to @/components/game-ui PauseOverlay');
      }
      if (!/PauseOverlay/.test(overlay)) {
        problems.push('components/pause-overlay.tsx does not reference PauseOverlay');
      }
      return problems;
    });
  });

  it('QA panel wraps the shared QaPanelShell', () => {
    collectViolations((game) => {
      const panel = requireFile(game, 'components/qa-panel.tsx');
      if (!/QaPanelShell/.test(panel)) {
        return ['components/qa-panel.tsx must wrap the shared QaPanelShell'];
      }
      return [];
    });
  });

  it('renders the QA panel only behind isDevBuild()', () => {
    collectViolations((game) => {
      const screen = requireFile(game, 'screen.tsx');
      if (!/isDevBuild\(\)/.test(screen)) {
        return ['screen.tsx never gates dev-only UI behind isDevBuild()'];
      }
      return [];
    });
  });
});

describe('QA hooks + tutorial lifecycle (hooks.ts)', () => {
  it('force-state hooks call assertDevOnly() and tutorials use the SDK lifecycle', () => {
    collectViolations((game) => {
      const hooks = requireFile(game, 'hooks.ts');
      const problems: string[] = [];
      if (!/assertDevOnly\(\)/.test(hooks)) {
        problems.push('hooks.ts QA force hooks must call assertDevOnly()');
      }
      if (!/createTutorialLifecycle/.test(hooks)) {
        problems.push('hooks.ts must build the tutorial via createTutorialLifecycle()');
      }
      return problems;
    });
  });
});

describe('tutorial surface', () => {
  it('exposes the stable <gameId>.tutorial testID (directly or via TutorialFrame)', () => {
    collectViolations((game) => {
      const tutorial = requireFile(game, 'components/tutorial.tsx');
      const stableId = /testId\(\s*GAME_ID\s*,\s*['"]tutorial['"]\)/.test(tutorial);
      if (!stableId && !/TutorialFrame/.test(tutorial)) {
        return ['components/tutorial.tsx lacks the stable testId(GAME_ID, "tutorial") surface'];
      }
      return [];
    });
  });
});

describe('persistence + diagnostics', () => {
  it('session.ts builds diagnostic metadata and exposes dbSessionPersister', () => {
    collectViolations((game) => {
      const session = requireFile(game, 'session.ts');
      const problems: string[] = [];
      if (!/createDiagnosticMetadata/.test(session)) {
        problems.push('session.ts must persist createDiagnosticMetadata() metadata');
      }
      if (!/dbSessionPersister/.test(session)) {
        problems.push('session.ts must export the dbSessionPersister seam');
      }
      return problems;
    });
  });

  it('versions.ts declares SCORING_VERSION and versionToNumber', () => {
    collectViolations((game) => {
      const versions = requireFile(game, 'versions.ts');
      const problems: string[] = [];
      if (!/SCORING_VERSION/.test(versions)) {
        problems.push('versions.ts must declare SCORING_VERSION');
      }
      if (!/versionToNumber/.test(versions)) {
        problems.push('versions.ts must declare versionToNumber');
      }
      return problems;
    });
  });
});

describe('adaptive difficulty contract', () => {
  it('difficulty.ts handles the adaptive level explicitly', () => {
    collectViolations((game) => {
      const difficulty = requireFile(game, 'difficulty.ts');
      if (!/['"]adaptive['"]/.test(difficulty)) {
        return ['difficulty.ts never handles the adaptive level'];
      }
      return [];
    });
  });
});

describe('testID convention', () => {
  it('no raw testID="..." JSX literals outside __tests__ (all ids flow through testId())', () => {
    collectViolations((game) => {
      const problems: string[] = [];
      for (const [relative, content] of game.files) {
        const matches = content.match(/testID\s*=\s*["'][^"']+["']/g);
        if (matches !== null) {
          problems.push(`${relative} uses raw testID literals (${matches[0]}…); use testId(gameId, …)`);
        }
      }
      return problems;
    });
  });
});

describe('sensory event vocabulary conformance', () => {
  function extractCallLiterals(content: string, callName: string): string[] {
    const literals: string[] = [];
    const callPattern = new RegExp(`\\.${callName}\\(([^)]*)`, 'g');
    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(content)) !== null) {
      const literalPattern = /['"]([a-z0-9-]+)['"]/g;
      let literal: RegExpExecArray | null;
      while ((literal = literalPattern.exec(match[1])) !== null) {
        literals.push(literal[1]);
      }
    }
    return literals;
  }

  it('every playSfx/feedback sound literal resolves to a canonical asset', () => {
    collectViolations((game) => {
      const problems: string[] = [];
      for (const [relative, content] of game.files) {
        for (const callName of ['playSfx', 'feedback'] as const) {
          for (const name of extractCallLiterals(content, callName)) {
            const canonical = SFX_ALIASES[name] ?? name;
            if (!CANONICAL_SFX.has(canonical)) {
              problems.push(
                `${relative}: ${callName}('${name}') resolves to '${canonical}', which is not a canonical asset — add an SFX_ALIASES entry or use a canonical name`,
              );
            }
          }
        }
      }
      return problems;
    });
  });

  it('every haptic literal is a valid HapticType', () => {
    collectViolations((game) => {
      const problems: string[] = [];
      for (const [relative, content] of game.files) {
        for (const type of extractCallLiterals(content, 'haptic')) {
          if (!HAPTIC_TYPES.has(type)) {
            problems.push(`${relative}: haptic('${type}') is not a valid HapticType`);
          }
        }
      }
      return problems;
    });
  });
});
