/**
 * `GameDefinition` metadata contract (constitution §8 library taxonomy; §11
 * game module architecture).
 *
 * The orchestrator's registry generator consumes `GameDefinition` objects
 * from each game's `game.json` file via `parseGameDefinitionJson` — games
 * must not hand-edit any shared registry.
 */
import { SDK_VERSION } from '../version';

/** Primary browse categories (constitution §8). */
export const GAME_CATEGORIES = [
  'Memory',
  'Attention',
  'Speed',
  'Math',
  'Language',
  'Logic & Problem Solving',
  'Flexibility',
  'Spatial',
] as const;

export type GameCategory = (typeof GAME_CATEGORIES)[number];

export function isGameCategory(value: unknown): value is GameCategory {
  return typeof value === 'string' && (GAME_CATEGORIES as readonly string[]).includes(value);
}

/** Stable, kebab-case game id — never changes once shipped (records depend on it). */
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface GameDefinition {
  /** Stable unique id, kebab-case (e.g. `memory-sequence`). Never rename once shipped. */
  id: string;
  /** Player-facing display name. */
  name: string;
  /** Primary browse category; exactly one. */
  primaryCategory: GameCategory;
  /** Optional secondary cognitive domains (may overlap with rating domains). */
  secondaryDomains?: readonly GameCategory[];
  /** One-line player-facing description shown in the library. */
  description?: string;
  /** SDK contract version the game was built against; see `SDK_VERSION`. */
  sdkVersion: string;
  /** Game mechanics/content version; bump on any change that alters gameplay or scoring. */
  gameVersion: string;
  /**
   * Generator version, or `null` for non-procedural games (curated packs,
   * validated templates). Bump whenever generated challenges may change.
   */
  generatorVersion: string | null;
  /**
   * Content bank version, or `null` for games without external content packs.
   * Bump when the content bank (word lists, sentence banks, pack.json) changes
   * in a way that affects challenge identity. For curated games, this is the
   * primary version tracking challenge changes. For hybrid games, this tracks
   * content bank changes while generatorVersion tracks algorithm changes.
   */
  contentVersion: string | null;
  /** Whether the game ships a first-play tutorial (see `tutorial.ts`). */
  hasTutorial: boolean;
}

function fail(message: string): never {
  throw new Error(`GameDefinition: ${message}`);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`field "${field}" must be a non-empty string`);
  }
  return value;
}

/**
 * Validate and freeze a `GameDefinition`. Throws on any contract violation.
 * Games call this (directly or via their `game.json` loader) at module load.
 */
export function defineGame(definition: GameDefinition): Readonly<GameDefinition> {
  const { id, name, primaryCategory, sdkVersion, gameVersion, generatorVersion, contentVersion, hasTutorial } =
    definition;

  if (typeof id !== 'string' || !GAME_ID_PATTERN.test(id)) {
    fail(`field "id" must be a kebab-case string matching ${GAME_ID_PATTERN}, got ${String(id)}`);
  }
  requireString(name, 'name');
  requireString(sdkVersion, 'sdkVersion');
  requireString(gameVersion, 'gameVersion');
  if (!isGameCategory(primaryCategory)) {
    fail(`field "primaryCategory" must be one of ${GAME_CATEGORIES.join(', ')}, got ${String(primaryCategory)}`);
  }
  if (generatorVersion !== null && (typeof generatorVersion !== 'string' || generatorVersion.length === 0)) {
    fail('field "generatorVersion" must be a non-empty string or null');
  }
  if (contentVersion !== null && (typeof contentVersion !== 'string' || contentVersion.length === 0)) {
    fail('field "contentVersion" must be a non-empty string or null');
  }
  if (typeof hasTutorial !== 'boolean') {
    fail('field "hasTutorial" must be a boolean');
  }
  if (definition.description !== undefined && (typeof definition.description !== 'string' || definition.description.length === 0)) {
    fail('field "description" must be a non-empty string or undefined');
  }
  if (definition.secondaryDomains !== undefined) {
    if (!Array.isArray(definition.secondaryDomains)) {
      fail('field "secondaryDomains" must be an array of categories or undefined');
    }
    for (const domain of definition.secondaryDomains) {
      if (!isGameCategory(domain)) {
        fail(`field "secondaryDomains" contains invalid category ${String(domain)}`);
      }
    }
  }

  // Normalize: drop an empty secondaryDomains array so serialized forms are uniform.
  const secondaryDomains =
    definition.secondaryDomains !== undefined && definition.secondaryDomains.length > 0
      ? (definition.secondaryDomains.slice() as readonly GameCategory[])
      : undefined;

  return Object.freeze({
    id,
    name,
    primaryCategory,
    ...(secondaryDomains !== undefined ? { secondaryDomains } : {}),
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    sdkVersion,
    gameVersion,
    generatorVersion,
    contentVersion,
    hasTutorial,
  });
}

/**
 * Parse and validate an unknown JSON value (from a game's `game.json`) into a
 * frozen `GameDefinition`. Used by the registry generator and by games that
 * load their own metadata at runtime.
 */
export function parseGameDefinitionJson(json: unknown): GameDefinition {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    fail('game.json must be a JSON object');
  }
  const raw = json as Record<string, unknown>;

  const secondaryDomainsRaw = raw.secondaryDomains;
  const secondaryDomains =
    secondaryDomainsRaw === undefined
      ? undefined
      : Array.isArray(secondaryDomainsRaw)
        ? (secondaryDomainsRaw as unknown[])
        : undefined;
  if (raw.secondaryDomains !== undefined && secondaryDomains === undefined) {
    fail('field "secondaryDomains" must be an array of categories or undefined');
  }

  const generatorVersion = raw.generatorVersion;
  if (generatorVersion !== null && typeof generatorVersion !== 'string') {
    fail('field "generatorVersion" must be a string or null');
  }

  const contentVersion = raw.contentVersion;
  if (contentVersion !== null && contentVersion !== undefined && typeof contentVersion !== 'string') {
    fail('field "contentVersion" must be a string, null, or undefined');
  }

  const description = raw.description;
  if (description !== undefined && (typeof description !== 'string' || description.length === 0)) {
    fail('field "description" must be a non-empty string or undefined');
  }

  return defineGame({
    id: requireString(raw.id, 'id'),
    name: requireString(raw.name, 'name'),
    primaryCategory: requireString(raw.primaryCategory, 'primaryCategory') as GameCategory,
    ...(secondaryDomains !== undefined ? { secondaryDomains: secondaryDomains as GameCategory[] } : {}),
    ...(description !== undefined ? { description: description as string } : {}),
    sdkVersion: requireString(raw.sdkVersion, 'sdkVersion'),
    gameVersion: requireString(raw.gameVersion, 'gameVersion'),
    generatorVersion: generatorVersion as string | null,
    contentVersion: (contentVersion as string | null) ?? null,
    hasTutorial: raw.hasTutorial as boolean,
  });
}

/**
 * Default `sdkVersion` games can report when built against the current SDK.
 * Games should prefer recording the version they actually declared.
 */
export const CURRENT_SDK_VERSION: string = SDK_VERSION;
