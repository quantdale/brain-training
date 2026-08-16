/**
 * Word Match — bundled content-pack loader + validation.
 *
 * The game ships a curated, versioned content pack (constitution §10 content
 * strategy: curated/versioned packs for vocabulary; §31 Phase-2 "curated/
 * content-pack language"). The pack is validated mechanically at module load
 * (`loadContentPack`), so an invalid pack fails fast instead of producing
 * broken rounds. The registry contract marks this game `generatorVersion: null`
 * because challenges come from this curated pack, not a procedural generator.
 *
 * Confusability contract (verified by validation code, not asserted by hand):
 * every item belongs to a semantic `family` — a homogeneous group of same
 * part-of-speech semantic neighbors declared in the pack. The prompt and all
 * four options must be members of the item's family word list, which makes
 * every distractor a genuine semantic neighbor of the prompt. The correct
 * answer is the pack author's declared mapping (`correctIndex`); validation
 * enforces that it differs from the prompt, is unique among the options, and
 * that the prompt never appears as an option.
 */
import packJson from './content/pack.json';

/** Word tiers inside the pack; difficulty selects which tiers are used. */
export type Tier = 't1' | 't2' | 't3';

export const TIERS: readonly Tier[] = ['t1', 't2', 't3'];

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

/** One validated round-data item of the pack. */
export interface PackItem {
  readonly id: string;
  /** The word shown to the player. */
  readonly prompt: string;
  /** Exactly four option words; one is the correct synonym. */
  readonly options: readonly string[];
  /** Index into `options` of the correct synonym (the author's mapping). */
  readonly correctIndex: number;
  /** Derived: `options[correctIndex]` — the correct word. */
  readonly correctWord: string;
  /** Difficulty tier of this item. */
  readonly tier: Tier;
  /** Semantic family id (see module docs); every word of the item is a member. */
  readonly family: string;
}

/** The validated content pack. All fields are frozen after validation. */
export interface ContentPack {
  readonly packId: string;
  readonly packVersion: string;
  /** Must equal `items.length`. */
  readonly itemCount: number;
  /** Semantic family id → member words (homogeneous synonym groups). */
  readonly families: Readonly<Record<string, readonly string[]>>;
  readonly items: readonly PackItem[];
}

/** Thrown when the bundled pack violates the content contract. */
export class ContentPackError extends Error {
  constructor(message: string) {
    super(`ContentPack: ${message}`);
    this.name = 'ContentPackError';
  }
}

function fail(message: string): never {
  throw new ContentPackError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalized comparison form: trimmed, lowercased. */
function norm(word: string): string {
  return word.trim().toLowerCase();
}

function requireWord(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`field "${where}" must be a non-empty string`);
  }
  return value;
}

/**
 * Validate an unknown JSON value (the bundled pack.json) into a frozen,
 * fully-verified `ContentPack`. Throws `ContentPackError` on the first
 * violation. Every check below is mechanical — nothing is asserted by hand.
 */
export function validateContentPack(json: unknown): ContentPack {
  if (!isPlainObject(json)) {
    fail('pack must be a JSON object');
  }

  const packId = requireWord(json.packId, 'packId');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId)) {
    fail(`packId "${packId}" must be kebab-case (stable, never renamed once shipped)`);
  }
  const packVersion = requireWord(json.packVersion, 'packVersion');
  if (!/^\d+\.\d+\.\d+$/.test(packVersion)) {
    fail(`packVersion "${packVersion}" must be a semantic version like "1.0.0"`);
  }

  // ---- Families: homogeneous semantic groups, words unique across all of them.
  if (!isPlainObject(json.families)) {
    fail('families must be an object of familyId → word array');
  }
  const families: Record<string, readonly string[]> = {};
  const wordOwner = new Map<string, string>();
  for (const [familyId, rawWords] of Object.entries(json.families)) {
    if (!Array.isArray(rawWords)) {
      fail(`family "${familyId}" must be an array of words`);
    }
    if (rawWords.length < 5) {
      fail(`family "${familyId}" must have at least 5 words (prompt + 4 options)`);
    }
    const words: string[] = [];
    const seen = new Set<string>();
    for (const rawWord of rawWords) {
      const word = norm(requireWord(rawWord, `families.${familyId}`));
      if (seen.has(word)) {
        fail(`family "${familyId}" contains duplicate word "${rawWord}"`);
      }
      seen.add(word);
      const owner = wordOwner.get(word);
      if (owner !== undefined) {
        fail(`word "${rawWord}" appears in both family "${owner}" and "${familyId}"`);
      }
      wordOwner.set(word, familyId);
      words.push(rawWord);
    }
    families[familyId] = words;
  }

  // ---- Items.
  if (!Array.isArray(json.items)) {
    fail('items must be an array');
  }
  if (typeof json.itemCount !== 'number' || !Number.isInteger(json.itemCount)) {
    fail('itemCount must be an integer');
  }
  if (json.itemCount !== json.items.length) {
    fail(`itemCount (${json.itemCount}) does not match items.length (${json.items.length})`);
  }

  const itemIds = new Set<string>();
  const prompts = new Set<string>();
  const items: PackItem[] = [];
  for (const [index, raw] of json.items.entries()) {
    if (!isPlainObject(raw)) {
      fail(`items[${index}] must be an object`);
    }
    const where = `items[${index}]`;

    const id = requireWord(raw.id, `${where}.id`);
    if (itemIds.has(id)) {
      fail(`duplicate item id "${id}"`);
    }
    itemIds.add(id);

    const prompt = requireWord(raw.prompt, `${where}.prompt`);
    const promptNorm = norm(prompt);
    if (prompts.has(promptNorm)) {
      fail(`duplicate prompt "${prompt}"`);
    }
    prompts.add(promptNorm);

    if (!isTier(raw.tier)) {
      fail(`${where}.tier must be one of t1/t2/t3, got ${String(raw.tier)}`);
    }

    if (typeof raw.family !== 'string' || families[raw.family] === undefined) {
      fail(`${where}.family "${String(raw.family)}" is not a declared family`);
    }
    const familyWords = new Set(families[raw.family].map(norm));

    if (!Array.isArray(raw.options) || raw.options.length !== 4) {
      const got = Array.isArray(raw.options) ? String(raw.options.length) : typeof raw.options;
      fail(`${where}.options must be exactly 4 options, got ${got}`);
    }
    const options: string[] = [];
    const optionNorms = new Set<string>();
    for (const [optionIndex, rawOption] of raw.options.entries()) {
      const option = requireWord(rawOption, `${where}.options[${optionIndex}]`);
      const optionNorm = norm(option);
      if (optionNorms.has(optionNorm)) {
        fail(`${where}.options contains duplicate word "${option}"`);
      }
      optionNorms.add(optionNorm);
      options.push(option);
    }

    if (
      typeof raw.correctIndex !== 'number' ||
      !Number.isInteger(raw.correctIndex) ||
      raw.correctIndex < 0 ||
      raw.correctIndex >= 4
    ) {
      fail(`${where}.correctIndex must be an integer in [0, 4), got ${String(raw.correctIndex)}`);
    }
    const correctWord = options[raw.correctIndex];

    // The author's mapping: the correct answer is a real synonym, so it must
    // differ from the prompt, and the prompt must never appear as an option.
    if (norm(correctWord) === promptNorm) {
      fail(`${where}: correct answer "${correctWord}" must differ from the prompt`);
    }
    if (optionNorms.has(promptNorm)) {
      fail(`${where}: the prompt "${prompt}" must not appear among the options`);
    }

    // Every word of the item must be a member of the item's semantic family —
    // this is the mechanical confusability guarantee for the distractors.
    for (const word of [prompt, ...options]) {
      if (!familyWords.has(norm(word))) {
        fail(`${where}: word "${word}" is not a member of family "${raw.family}"`);
      }
    }

    items.push(
      Object.freeze({
        id,
        prompt,
        options: Object.freeze(options),
        correctIndex: raw.correctIndex,
        correctWord,
        tier: raw.tier,
        family: raw.family,
      }),
    );
  }

  return Object.freeze({
    packId,
    packVersion,
    itemCount: json.itemCount,
    families: Object.freeze(families),
    items: Object.freeze(items),
  });
}

let cached: ContentPack | null = null;

/**
 * Load and validate the bundled pack (memoized; validation runs once per
 * module lifetime and fails fast on a broken pack).
 */
export function loadContentPack(): ContentPack {
  if (cached === null) {
    cached = validateContentPack(packJson);
  }
  return cached;
}

/** The correct word of an item (convenience over `options[correctIndex]`). */
export function correctWordOf(item: PackItem): string {
  return item.options[item.correctIndex];
}
