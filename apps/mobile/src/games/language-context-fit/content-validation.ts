/**
 * Context Fit — bundled content-pack loader + validation.
 *
 * Validates distinctness, tier structure, grammar-compatibility and
 * morphology/POS metadata so distractors cannot be eliminated by trivial
 * grammar. Every check is mechanical; curated `pos` metadata documents the
 * intended slot role and is cross-checked by a lightweight morphology
 * heuristic (plural / gerund / adverb consistency).
 */
import packJson from './content/pack.json';

export type Tier = 't1' | 't2' | 't3';

export const TIERS: readonly Tier[] = ['t1', 't2', 't3'];

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

export type PosTag = 'noun' | 'verb' | 'adj' | 'adv';

export const POS_TAGS: readonly PosTag[] = ['noun', 'verb', 'adj', 'adv'] as const;

export function isPosTag(value: unknown): value is PosTag {
  return typeof value === 'string' && (POS_TAGS as readonly string[]).includes(value);
}

export interface PackItem {
  readonly id: string;
  readonly context: string;
  readonly answer: string;
  readonly distractors: readonly string[];
  readonly tier: Tier;
  /** Curated part-of-speech / morphology tag for the blank slot; all options share this slot. */
  readonly pos: PosTag;
}

export interface ContentPack {
  readonly packId: string;
  readonly packVersion: string;
  readonly itemCount: number;
  readonly items: readonly PackItem[];
}

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

function norm(word: string): string {
  return word.trim().toLowerCase();
}

function requireWord(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`field "${where}" must be a non-empty string`);
  }
  return value;
}

export function blankCount(context: string): number {
  return context.split('___').length - 1;
}

// ---- Morphology helpers for grammar-leak detection ----
// Plural detection is intentionally conservative: only regular noun plurals
// (trailing s not part of -ss/-us/-ous/-is/-ness endings) are considered
// plural. Adjectives ending with -ous/-ious are not plural nouns.
function isPlural(word: string): boolean {
  const w = word.trim().toLowerCase();
  if (w.length <= 3) return false;
  if (w.endsWith('ss')) return false;
  if (w.endsWith('us')) return false;
  if (w.endsWith('ous')) return false;
  if (w.endsWith('is')) return false;
  if (w.endsWith('ness')) return false;
  return w.endsWith('s');
}

function isGerund(word: string): boolean {
  const w = word.trim().toLowerCase();
  return w.length > 4 && w.endsWith('ing');
}

function isAdverb(word: string): boolean {
  const w = word.trim().toLowerCase();
  return w.length > 4 && w.endsWith('ly');
}

export function isGrammarCompatible(
  answer: string,
  distractors: readonly string[],
  pos: PosTag | null,
): boolean {
  // POS-aware: only enforce the morphology dimension relevant to the declared slot.
  // For nouns, plural must match; for verbs, gerund must match; for adverbs,
  // adverb form must match. Adjectives have no number/gerund constraint.
  const aPlural = isPlural(answer);
  const aGerund = isGerund(answer);
  const aAdv = isAdverb(answer);
  for (const d of distractors) {
    if (pos === 'noun' || pos === null) {
      if (isPlural(d) !== aPlural) return false;
    }
    if (pos === 'verb' || pos === null) {
      if (isGerund(d) !== aGerund) return false;
    }
    if (pos === 'adv' || pos === null) {
      if (isAdverb(d) !== aAdv) return false;
    }
    // Fallback for missing POS or adv/noun cross-check: adverb mismatch is leakable regardless
    if (pos === null && isAdverb(d) !== aAdv) return false;
  }
  return true;
}

function versionGte(version: string, target: string): boolean {
  const pa = version.split('.').map((n) => Number(n) || 0);
  const ta = target.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i += 1) {
    const p = pa[i] ?? 0;
    const t = ta[i] ?? 0;
    if (p > t) return true;
    if (p < t) return false;
  }
  return true;
}

export function validateContentPack(json: unknown): ContentPack {
  if (!isPlainObject(json)) fail('pack must be a JSON object');

  const packId = requireWord(json.packId, 'packId');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId)) fail(`packId "${packId}" must be kebab-case`);
  const packVersion = requireWord(json.packVersion, 'packVersion');
  if (!/^\d+\.\d+\.\d+$/.test(packVersion)) fail(`packVersion "${packVersion}" must be semver`);

  if (!Array.isArray(json.items)) fail('items must be an array');
  if (typeof json.itemCount !== 'number' || !Number.isInteger(json.itemCount)) fail('itemCount must be an integer');
  if (json.itemCount !== json.items.length) fail(`itemCount (${json.itemCount}) != items.length (${json.items.length})`);

  const itemIds = new Set<string>();
  const contexts = new Set<string>();
  const answers = new Set<string>();
  const tierCounts = new Map<Tier, number>([
    ['t1', 0],
    ['t2', 0],
    ['t3', 0],
  ]);
  const items: PackItem[] = [];
  for (const [index, raw] of json.items.entries()) {
    if (!isPlainObject(raw)) fail(`items[${index}] must be an object`);
    const where = `items[${index}]`;

    const id = requireWord(raw.id, `${where}.id`);
    if (itemIds.has(id)) fail(`duplicate item id "${id}"`);
    itemIds.add(id);

    const context = requireWord(raw.context, `${where}.context`);
    const contextNorm = norm(context);
    if (contexts.has(contextNorm)) fail(`duplicate context "${context}"`);
    contexts.add(contextNorm);
    if (blankCount(context) !== 1) fail(`${where}.context must contain exactly one "___" (found ${blankCount(context)})`);

    if (typeof raw.tier !== 'string' || !isTier(raw.tier)) fail(`${where}.tier must be t1/t2/t3, got ${String(raw.tier)}`);
    tierCounts.set(raw.tier, (tierCounts.get(raw.tier) ?? 0) + 1);

    const answer = requireWord(raw.answer, `${where}.answer`);
    const answerNorm = norm(answer);
    if (answers.has(answerNorm)) fail(`duplicate normalized answer "${answer}" across the pack`);
    answers.add(answerNorm);

    if (!Array.isArray(raw.distractors) || raw.distractors.length < 3) {
      const got = Array.isArray(raw.distractors) ? String(raw.distractors.length) : typeof raw.distractors;
      fail(`${where}.distractors must be an array of >=3 words, got ${got}`);
    }
    const distractorNorms = new Set<string>();
    for (const [optionIndex, rawOption] of (raw.distractors as unknown[]).entries()) {
      const option = requireWord(rawOption, `${where}.distractors[${optionIndex}]`);
      const optionNorm = norm(option);
      if (optionNorm === answerNorm) fail(`${where}: a distractor equals the answer "${answer}"`);
      if (distractorNorms.has(optionNorm)) fail(`${where}.distractors contains duplicate word "${option}"`);
      distractorNorms.add(optionNorm);
    }

    // POS / curated morphology metadata
    const posRaw = (raw as Record<string, unknown>).pos;
    let pos: PosTag | null = null;
    let storedPos: PosTag = 'noun';
    if (posRaw === undefined) {
      // For packVersion >=2.0.0 pos is required; older test packs (1.x) remain backward compatible.
      if (versionGte(packVersion, '2.0.0')) {
        fail(`${where}.pos is required for packVersion ${packVersion} (must be one of ${POS_TAGS.join('/')})`);
      }
      storedPos = 'noun';
      pos = null;
    } else {
      if (!isPosTag(posRaw)) fail(`${where}.pos must be one of ${POS_TAGS.join('/')}, got ${String(posRaw)}`);
      pos = posRaw;
      storedPos = posRaw;
    }

    // Grammar-leak heuristic: answer and all distractors must share plural/gerund/adverb class
    const distractors = raw.distractors as string[];
    if (!isGrammarCompatible(answer, distractors, pos)) {
      fail(
        `${where}: grammar-leaking distractors — answer "${answer}" and distractors [${distractors.join(', ')}] differ in plural/gerund/adverb form (all options must share the same morphology for the blank)`,
      );
    }

    items.push(
      Object.freeze({
        id,
        context,
        answer,
        distractors: Object.freeze((raw.distractors as string[]).slice()) as readonly string[],
        tier: raw.tier as Tier,
        pos: storedPos,
      }),
    );
  }

  // Tier depth gate: active curated pack must provide >=60 per tier and >=180 total.
  // Only enforced for version >=2.0.0 so small test fixtures (1.x clonePacks) remain valid.
  if (versionGte(packVersion, '2.0.0')) {
    const total = items.length;
    if (total < 180) fail(`packVersion ${packVersion} requires at least 180 items, got ${total}`);
    for (const tier of TIERS) {
      const count = tierCounts.get(tier) ?? 0;
      if (count < 60) fail(`packVersion ${packVersion} requires at least 60 items per tier, got ${tier}=${count}`);
    }
  }

  return Object.freeze({
    packId,
    packVersion,
    itemCount: json.itemCount,
    items: Object.freeze(items),
  });
}

let cached: ContentPack | null = null;

export function loadContentPack(): ContentPack {
  if (cached === null) cached = validateContentPack(packJson);
  return cached;
}

// Test helper: clear memoization after pack replacement (jest).
export function __resetContentPackCache(): void {
  cached = null;
}
