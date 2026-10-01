#!/usr/bin/env node
/**
 * Deterministic game-registry generator.
 *
 * Scans `apps/mobile/src/games/<id>/game.json` files and emits
 * `apps/mobile/src/registry/registry.generated.ts`. Games never hand-edit
 * the registry (constitution §11, §30): each self-contained game module
 * only provides its own `game.json`; the orchestrator runs this script.
 *
 * Deterministic: same game.json inputs always produce the same output file
 * (sorted by game id; no timestamps). Structural validation here mirrors
 * the SDK's `defineGame`/`parseGameDefinitionJson` contract in
 * `apps/mobile/src/sdk/types/game-definition.ts`; the app re-validates at
 * startup via `registerGameDefinitions`.
 *
 * Usage: node scripts/generate-game-registry.mjs [--check] [--self-check]
 *   --check       verify the generated file is up to date (exit 1 if stale).
 *   --self-check  run the in-memory validation contract fixtures and exit.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');
const OUT_FILE = join(REPO_ROOT, 'apps', 'mobile', 'src', 'registry', 'registry.generated.ts');
const GENERATOR_VERSION = '1';

/** Must stay in sync with SDK `GAME_CATEGORIES` (src/sdk/types/game-definition.ts). */
const GAME_CATEGORIES = [
  'Memory',
  'Attention',
  'Speed',
  'Math',
  'Language',
  'Logic & Problem Solving',
  'Flexibility',
  'Spatial',
];

const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(file, message) {
  throw new Error(`registry generator: ${file}: ${message}`);
}

function assertString(value, file, field) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(file, `game.json field "${field}" must be a non-empty string`);
  }
  return value;
}

/** Validate one game.json; returns the object to embed in the generated file. */
function parseGameJson(file, raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(file, 'game.json must be a JSON object');
  }
  const id = assertString(raw.id, file, 'id');
  if (!GAME_ID_PATTERN.test(id)) {
    fail(file, `id "${id}" must be kebab-case (e.g. memory-sequence)`);
  }
  assertString(raw.name, file, 'name');
  assertString(raw.primaryCategory, file, 'primaryCategory');
  if (!GAME_CATEGORIES.includes(raw.primaryCategory)) {
    fail(
      file,
      `primaryCategory "${raw.primaryCategory}" must be one of ${GAME_CATEGORIES.join(', ')}`,
    );
  }
  if (raw.secondaryDomains !== undefined) {
    if (!Array.isArray(raw.secondaryDomains)) {
      fail(file, 'secondaryDomains must be an array of categories or undefined');
    }
    for (const domain of raw.secondaryDomains) {
      if (!GAME_CATEGORIES.includes(domain)) {
        fail(file, `secondaryDomains contains invalid category "${domain}"`);
      }
    }
  }
  assertString(raw.sdkVersion, file, 'sdkVersion');
  assertString(raw.gameVersion, file, 'gameVersion');
  // Mirror the runtime SDK contract exactly (parseGameDefinitionJson/defineGame
  // in src/sdk/types/game-definition.ts): `generatorVersion` is null or a
  // NON-EMPTY string, `contentVersion` is null/undefined or a non-empty string,
  // and `description` (when present) is a non-empty string. The app re-validates
  // at bootstrap, so a value accepted only here would surface as a startup crash
  // — reject it at generation time instead, naming the game.
  if (
    raw.generatorVersion !== null &&
    (typeof raw.generatorVersion !== 'string' || raw.generatorVersion.length === 0)
  ) {
    fail(file, 'generatorVersion must be a non-empty string or null');
  }
  if (
    raw.contentVersion !== null &&
    raw.contentVersion !== undefined &&
    (typeof raw.contentVersion !== 'string' || raw.contentVersion.length === 0)
  ) {
    fail(file, 'contentVersion must be a non-empty string, null, or undefined');
  }
  if (
    raw.description !== undefined &&
    (typeof raw.description !== 'string' || raw.description.length === 0)
  ) {
    fail(file, 'description must be a non-empty string or undefined');
  }
  if (typeof raw.hasTutorial !== 'boolean') {
    fail(file, 'hasTutorial must be a boolean');
  }

  return raw;
}

function collectGameIds() {
  let entries = [];
  try {
    entries = readdirSync(GAMES_DIR, { withFileTypes: true });
  } catch {
    return []; // games dir does not exist yet -> empty registry
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // Test-support folders (`__tests__`, `__fixtures__`, …) may live alongside
    // game modules by repository convention. They are not game ids and must not
    // be treated as game directories missing a game.json.
    .filter((name) => !name.startsWith('__'))
    .sort();
}

function generate() {
  const games = [];
  for (const gameId of collectGameIds()) {
    const gameJsonPath = join(GAMES_DIR, gameId, 'game.json');
    let raw;
    try {
      raw = JSON.parse(readFileSync(gameJsonPath, 'utf8'));
    } catch (error) {
      fail(join('src/games', gameId, 'game.json'), `unreadable or invalid JSON: ${error.message}`);
    }
    if (raw.id !== gameId) {
      fail(
        join('src/games', gameId, 'game.json'),
        `game.json id "${raw.id}" must match its directory name "${gameId}"`,
      );
    }
    games.push(parseGameJson(join('src/games', gameId, 'game.json'), raw));
  }

  const body = games
    .map((game) => {
      const lines = Object.entries(game).map(([key, value]) => {
        const rendered = JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
        return `    ${key}: ${rendered},`;
      });
      return `  {\n${lines.join('\n')}\n  },`;
    })
    .join('\n');

  // Each game directory is expected to export a default React component (the
  // game screen) from its index/module entry; the dynamic-import paths below
  // are static literals so Metro can resolve them at build time.
  const loaders = games
    .map((game) => `  '${game.id}': () => import('@/games/${game.id}'),`)
    .join('\n');

  return [
    '/**',
    ' * GENERATED FILE — do not edit by hand. Regenerate with:',
    ' *   node scripts/generate-game-registry.mjs',
    ' *',
    ' * Sources: game.json files under apps/mobile/src/games/<id>/.',
    ` * Generator version: ${GENERATOR_VERSION}. Deterministic output.`,
    ' */',
    'import type { ComponentType } from \'react\';',
    'import type { GameDefinition, GameScreenProps } from \'@/sdk\';',
    '',
    'export const registry: readonly GameDefinition[] = [',
    body,
    '];',
    '',
    '/**',
    ' * Lazy loaders from game id to the module that exports the game screen as',
    ' * its default export. The `app/game/[id].tsx` route resolves the screen',
    ' * through this map; games never hand-edit this file.',
    ' *',
    ' * The loader is typed with `GameScreenProps` (Change 074) rather than a bare',
    ' * `ComponentType`, which is `ComponentType<{}>` and therefore erases the props',
    ' * a game screen actually accepts. Carrying the real type here means a screen',
    ' * that stops accepting `tutorialStore` fails to type-check at the boundary',
    ' * instead of being handed a prop it silently ignores.',
    ' */',
    'export const gameScreenLoaders: Record<',
    '  string,',
    '  () => Promise<{ default: ComponentType<GameScreenProps> }>',
    '> = {',
    loaders,
    '};',
    '',
  ].join('\n');
}

const checkOnly = process.argv.includes('--check');

/**
 * In-memory fixtures pinning the SDK-mirrored validation contract. Runs the
 * SAME `parseGameJson` used for real game.json files, so a drift between this
 * generator and the runtime SDK (which rejects these at bootstrap) fails a
 * cheap, filesystem-free self-check. Invoked by `--self-check` and by the
 * governance test suite.
 */
function selfCheck() {
  const valid = {
    id: 'memory-sequence',
    name: 'Memory Sequence',
    primaryCategory: 'Memory',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1',
    contentVersion: null,
    hasTutorial: true,
    description: 'Remember and repeat the sequence.',
  };
  const cases = [
    { name: 'accepts a valid game.json', json: valid, expectError: null },
    {
      name: 'rejects an empty generatorVersion',
      json: { ...valid, generatorVersion: '' },
      expectError: /generatorVersion must be a non-empty string or null/,
    },
    {
      name: 'rejects an empty description',
      json: { ...valid, description: '' },
      expectError: /description must be a non-empty string or undefined/,
    },
    {
      name: 'rejects an empty contentVersion',
      json: { ...valid, contentVersion: '' },
      expectError: /contentVersion must be a non-empty string, null, or undefined/,
    },
  ];

  const failures = [];
  for (const fixture of cases) {
    let error = null;
    try {
      parseGameJson(`src/games/${fixture.name}/game.json`, fixture.json);
    } catch (err) {
      error = err;
    }
    if (fixture.expectError === null) {
      if (error) {
        failures.push(`${fixture.name}: unexpectedly rejected (${error.message})`);
      }
    } else if (!error || !fixture.expectError.test(error.message)) {
      failures.push(
        `${fixture.name}: expected rejection ${fixture.expectError} but got ${error ? error.message : 'acceptance'}`,
      );
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`registry generator self-check: ${failure}`);
    }
    process.exit(1);
  }
  console.log(`registry generator self-check: ${cases.length} cases passed`);
}

if (process.argv.includes('--self-check')) {
  selfCheck();
  process.exit(0);
}

const output = generate();

if (checkOnly) {
  let existing = null;
  try {
    existing = readFileSync(OUT_FILE, 'utf8');
  } catch {
    existing = null;
  }
  if (existing !== output) {
    console.error(`registry generator: ${OUT_FILE} is stale — run node scripts/generate-game-registry.mjs`);
    process.exit(1);
  }
  console.log('registry generator: generated registry is up to date');
  process.exit(0);
}

writeFileSync(OUT_FILE, output);
console.log(`registry generator: wrote ${OUT_FILE} (${GAME_CATEGORIES.length > 0 ? 'categories validated' : ''})`);
