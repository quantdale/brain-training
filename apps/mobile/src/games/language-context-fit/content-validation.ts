/**
 * Context Fit — bundled content-pack loader + validation.
 */
import packJson from './content/pack.json';

export type Tier = 't1' | 't2' | 't3';

export const TIERS: readonly Tier[] = ['t1', 't2', 't3'];

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

export interface PackItem {
  readonly id: string;
  readonly context: string;
  readonly answer: string;
  readonly distractors: readonly string[];
  readonly tier: Tier;
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

    items.push(
      Object.freeze({
        id,
        context,
        answer,
        distractors: Object.freeze(raw.distractors.slice()) as readonly string[],
        tier: raw.tier,
      }),
    );
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
