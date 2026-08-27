/**
 * Word Chain — bundled content-pack loader + validation.
 *
 * The game ships a curated, versioned content pack (constitution §10 content
 * strategy: curated/versioned packs for vocabulary). The pack is validated
 * mechanically at module load (`loadContentPack`), so an invalid pack fails
 * fast instead of producing broken rounds. The registry contract marks this
 * game `generatorVersion: null` because challenges come from this curated
 * pack, not a procedural generator.
 *
 * Chain contract (verified by validation code, not asserted by hand):
 * every chain is a sequence of single-token lowercase words where each next
 * word STARTS WITH the LAST LETTER of the previous word (the lexical
 * word-chain rule). The generator blanks some positions and offers options;
 * because distractors are drawn only from words that do NOT start with the
 * required letter, exactly one option is ever a valid link (see generator.ts).
 *
 * Near-duplicate / reordered-chain rule (mechanical):
 * two chains are "near-duplicates" if they share ≥2 normalized words in
 * common OR they contain the same multiset of words irrespective of order
 * (i.e., one is a reordering/permutation of the other). Such packs are
 * rejected because they reduce effective diversity and enable memorization
 * shortcuts. Exact duplicate sequences are also rejected. Tier constraints
 * require ≥30 chains per tier (t1/t2/t3) and ≥90 total, with tier-appropriate
 * length bands (t1: 4-5, t2/t3: 5-6). Decoy diversity requires ≥30 decoys,
 * all disjoint from chain words, with ≥15 distinct initials and no single
 * initial dominating the pool.
 */
import packJson from "./content/pack.json";

/** Word tiers inside the pack; difficulty selects which tiers are used. */
export type Tier = "t1" | "t2" | "t3";

export const TIERS: readonly Tier[] = ["t1", "t2", "t3"];

export function isTier(value: unknown): value is Tier {
  return (
    typeof value === "string" && (TIERS as readonly string[]).includes(value)
  );
}

/** One validated chain of the pack. */
export interface ChainItem {
  readonly id: string;
  /** Difficulty tier of this chain. */
  readonly tier: Tier;
  /** The full, correct word sequence (each next word starts with the previous last letter). */
  readonly words: readonly string[];
}

/** The validated content pack. All fields are frozen after validation. */
export interface WordChainPack {
  readonly packId: string;
  readonly packVersion: string;
  /** Must equal `chains.length`. */
  readonly chainCount: number;
  /** Words used only as distractors; disjoint from every chain word. */
  readonly decoyPool: readonly string[];
  readonly chains: readonly ChainItem[];
}

/** Thrown when the bundled pack violates the content contract. */
export class WordChainPackError extends Error {
  constructor(message: string) {
    super(`WordChainPack: ${message}`);
    this.name = "WordChainPackError";
  }
}

function fail(message: string): never {
  throw new WordChainPackError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalized comparison form: trimmed, lowercased. */
function norm(word: string): string {
  return word.trim().toLowerCase();
}

/** A single-token, lowercase a–z word of at least `minLen` letters. */
function isSingleTokenWord(value: unknown, minLen = 3): value is string {
  return (
    typeof value === "string" &&
    /^[a-z]+$/.test(value) &&
    value.length >= minLen
  );
}

/** Last letter of a normalized word (assumes non-empty a–z word). */
function lastLetter(word: string): string {
  return word[word.length - 1];
}

/**
 * Validate an unknown JSON value (the bundled pack.json) into a frozen,
 * fully-verified `WordChainPack`. Every check below is mechanical — nothing
 * is asserted by hand.
 */
export function validateWordChainPack(json: unknown): WordChainPack {
  if (!isPlainObject(json)) {
    fail("pack must be a JSON object");
  }

  const packId = json.packId;
  if (
    typeof packId !== "string" ||
    packId.length === 0 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId)
  ) {
    fail("packId must be a non-empty kebab-case string");
  }
  const packVersion = json.packVersion;
  if (typeof packVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(packVersion)) {
    fail('packVersion must be a semantic version like "1.0.0"');
  }

  // ---- decoyPool: single-token a–z words, disjoint from all chain words.
  // Decoy diversity contract: ≥30 decoys, ≥15 distinct initials, balanced
  // distribution so every required first-letter can find valid distractors.
  if (!Array.isArray(json.decoyPool)) {
    fail("decoyPool must be an array of words");
  }
  if (json.decoyPool.length < 30) {
    fail(`decoyPool must contain at least 30 words, got ${json.decoyPool.length}`);
  }
  const decoys = new Set<string>();
  for (const raw of json.decoyPool) {
    if (!isSingleTokenWord(raw)) {
      fail(
        `decoyPool word "${String(raw)}" must be a single-token lowercase a–z word of length ≥ 3`,
      );
    }
    const w = norm(raw);
    if (decoys.has(w)) {
      fail(`decoyPool contains a duplicate word "${w}"`);
    }
    decoys.add(w);
  }
  // Decoy initial-letter diversity: at least 15 distinct initials and no
  // single initial may cover more than 25% of the pool (avoids one-letter
  // dominance that would starve option generation for that letter).
  {
    const initials = new Map<string, number>();
    for (const w of decoys) {
      const ch = w[0];
      initials.set(ch, (initials.get(ch) ?? 0) + 1);
    }
    if (initials.size < 15) {
      fail(
        `decoyPool must cover at least 15 distinct initials, got ${initials.size}`,
      );
    }
    const maxPerInitial = Math.ceil(decoys.size * 0.25);
    for (const [ch, count] of initials) {
      if (count > maxPerInitial) {
        fail(
          `decoyPool initial "${ch}" appears ${count} times, exceeds ${maxPerInitial} (25% of pool)`,
        );
      }
    }
  }

  // ---- chains.
  if (!Array.isArray(json.chains)) {
    fail("chains must be an array");
  }
  if (
    typeof json.chainCount !== "number" ||
    !Number.isInteger(json.chainCount)
  ) {
    fail("chainCount must be an integer");
  }
  if (json.chainCount !== json.chains.length) {
    fail(
      `chainCount (${json.chainCount}) does not match chains.length (${json.chains.length})`,
    );
  }

  const chainIds = new Set<string>();
  const sequences = new Set<string>();
  const allChainWords = new Set<string>();
  const chains: ChainItem[] = [];

  for (const [index, raw] of json.chains.entries()) {
    if (!isPlainObject(raw)) {
      fail(`chains[${index}] must be an object`);
    }
    const where = `chains[${index}]`;

    const id = raw.id;
    if (typeof id !== "string" || id.length === 0) {
      fail(`${where}.id must be a non-empty string`);
    }
    if (chainIds.has(id)) {
      fail(`duplicate chain id "${id}"`);
    }
    chainIds.add(id);

    if (!isTier(raw.tier)) {
      fail(`${where}.tier must be one of t1/t2/t3, got ${String(raw.tier)}`);
    }

    if (
      !Array.isArray(raw.words) ||
      raw.words.length < 4 ||
      raw.words.length > 6
    ) {
      fail(
        `${where}.words must be an array of 4..6 words, got ${Array.isArray(raw.words) ? raw.words.length : typeof raw.words}`,
      );
    }
    const words: string[] = [];
    for (const [wi, rawWord] of raw.words.entries()) {
      if (!isSingleTokenWord(rawWord)) {
        fail(
          `${where}.words[${wi}] "${String(rawWord)}" must be a single-token lowercase a–z word of length ≥ 3`,
        );
      }
      const w = norm(rawWord);
      words.push(w);
      if (allChainWords.has(w)) {
        fail(
          `word "${w}" appears in more than one chain (chains must be disjoint word-wise)`,
        );
      }
      allChainWords.add(w);
      // Decoys must never equal a chain word (avoids accidental correctness).
      if (decoys.has(w)) {
        fail(`word "${w}" appears in both a chain and the decoyPool`);
      }
    }

    // Adjacency invariant: each next word starts with the previous last letter.
    for (let i = 1; i < words.length; i += 1) {
      if (words[i][0] !== lastLetter(words[i - 1])) {
        fail(
          `${where}: adjacency broken at position ${i} — "${words[i]}" does not start with "${lastLetter(words[i - 1])}" (last letter of "${words[i - 1]}")`,
        );
      }
    }

    // No two chains share the same normalized word sequence.
    const seqKey = JSON.stringify(words);
    if (sequences.has(seqKey)) {
      fail(`${where}: duplicate normalized word sequence across chains`);
    }
    sequences.add(seqKey);

    chains.push(
      Object.freeze({ id, tier: raw.tier, words: Object.freeze(words) }),
    );
  }

  // ---- tier-count and tier-length constraints (≥30 per tier, ≥90 total).
  // Enforced for the active core pack (packId === "language-word-chain-core-v1");
  // generic test packs with other ids may be smaller but must still satisfy
  // decoy diversity and adjacency invariants.
  if (packId === "language-word-chain-core-v1") {
    if (chains.length < 90) {
      fail(`pack must contain at least 90 chains, got ${chains.length}`);
    }
    const tierCounts: Record<Tier, number> = { t1: 0, t2: 0, t3: 0 };
    for (const chain of chains) {
      tierCounts[chain.tier] += 1;
    }
    for (const tier of TIERS) {
      if (tierCounts[tier] < 30) {
        fail(`tier ${tier} must have at least 30 chains, got ${tierCounts[tier]}`);
      }
    }
    // Tier-appropriate length bands: t1 4-5, t2/t3 5-6 (t1 easier, shorter).
    for (const chain of chains) {
      const len = chain.words.length;
      if (chain.tier === "t1" && (len < 4 || len > 5)) {
        fail(`chain ${chain.id} tier t1 must have 4-5 words, got ${len}`);
      }
      if ((chain.tier === "t2" || chain.tier === "t3") && (len < 5 || len > 6)) {
        fail(`chain ${chain.id} tier ${chain.tier} must have 5-6 words, got ${len}`);
      }
    }
  }

  // ---- near-duplicate / reordered-chain detection.
  // Two chains are near-duplicates if they share ≥2 words OR have the same
  // word multiset irrespective of order (reordered duplicate). Documented
  // threshold: ≥2 shared words.
  for (let i = 0; i < chains.length; i += 1) {
    for (let j = i + 1; j < chains.length; j += 1) {
      const a = chains[i];
      const b = chains[j];
      const setA = new Set(a.words);
      const setB = new Set(b.words);
      let shared = 0;
      for (const w of setA) {
        if (setB.has(w)) shared += 1;
      }
      if (shared >= 2) {
        fail(
          `chains ${a.id} and ${b.id} are near-duplicates: share ${shared} words (threshold ≥2)`,
        );
      }
      // Reordered duplicate: same multiset, different order.
      if (a.words.length === b.words.length) {
        const sortedA = [...a.words].sort().join("|");
        const sortedB = [...b.words].sort().join("|");
        if (sortedA === sortedB && JSON.stringify(a.words) !== JSON.stringify(b.words)) {
          fail(`chains ${a.id} and ${b.id} are reordered duplicates (same words, different order)`);
        }
      }
    }
  }

  return Object.freeze({
    packId,
    packVersion,
    chainCount: json.chainCount,
    decoyPool: Object.freeze([...decoys]),
    chains: Object.freeze(chains),
  });
}

let cached: WordChainPack | null = null;

/**
 * Load and validate the bundled pack (memoized; validation runs once per
 * module lifetime and fails fast on a broken pack).
 */
export function loadContentPack(): WordChainPack {
  if (cached === null) {
    cached = validateWordChainPack(packJson);
  }
  return cached;
}
