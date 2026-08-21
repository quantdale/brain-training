/**
 * Cosmetic collection progress + unlock provenance (engagement V2, campaign
 * 010 / W12). Pure: no db access. The UI passes the definitions, the
 * progression facts, and whatever evidence maps it has already loaded
 * (ledger entries / achievement unlocks / milestone claim ids) and gets a
 * deterministic collection summary and per-cosmetic provenance back.
 *
 * Provenance is DERIVED, never stored: earned cosmetics inherit their
 * evidence timestamps from the authoritative records (achievement unlocks,
 * quest claims, ledger purchase entries), so it cannot desync from the truth.
 */
import type {
  CosmeticDef,
  CosmeticProgression,
  CosmeticSlot,
} from './types';
import { COSMETIC_SLOTS } from './types';
import { isCosmeticOwned } from './state';

/** Owned/total counts for one cosmetic slot. */
export interface CollectionSlotProgress {
  slot: CosmeticSlot;
  owned: number;
  total: number;
  /** Clamped 0..1 owned fraction (0 when the slot is empty). */
  ratio: number;
}

/** Whole-collection summary across every slot. */
export interface CollectionSummary {
  slots: CollectionSlotProgress[];
  ownedTotal: number;
  total: number;
  /** Clamped 0..1 owned fraction of the whole catalog. */
  ratio: number;
}

/**
 * Compute collection progress per slot and overall, in slot order
 * (`COSMETIC_SLOTS`). Deterministic; inputs are never mutated.
 */
export function collectionProgress(
  definitions: readonly CosmeticDef[],
  progression: CosmeticProgression,
  settings: Record<string, unknown>,
): CollectionSummary {
  const slots: CollectionSlotProgress[] = COSMETIC_SLOTS.map((slot) => {
    const defs = definitions.filter((def) => def.slot === slot);
    const owned = defs.filter((def) => isCosmeticOwned(def, progression, settings)).length;
    return {
      slot,
      owned,
      total: defs.length,
      ratio: defs.length === 0 ? 0 : Math.min(owned / defs.length, 1),
    };
  });
  const ownedTotal = slots.reduce((sum, slot) => sum + slot.owned, 0);
  const total = slots.reduce((sum, slot) => sum + slot.total, 0);
  return { slots, ownedTotal, total, ratio: total === 0 ? 0 : Math.min(ownedTotal / total, 1) };
}

/** Evidence maps used to derive provenance timestamps (all optional). */
export interface ProvenanceEvidence {
  /** achievementId → unlock record (from `db.achievements.listUnlocks()`). */
  achievementUnlocks?: ReadonlyMap<string, { unlockedAt: number; claimedAt: number | null }>;
  /** questId → claim timestamp for the relevant period. */
  questClaims?: ReadonlyMap<string, number>;
  /** milestoneId → claim timestamp when the caller tracks one (optional). */
  milestoneClaims?: ReadonlyMap<string, number>;
  /** operationId → ledger entry creation time (e.g. `cosmetic:<id>`). */
  ledgerByOperation?: ReadonlyMap<string, number>;
}

/** How/when a cosmetic was (or can be) earned. */
export interface CosmeticProvenance {
  /** Whether the cosmetic is currently owned. */
  owned: boolean;
  source:
    | 'default'
    | 'purchase'
    | 'achievement'
    | 'quest'
    | 'streak-milestone';
  /** Unix epoch ms the reward was granted/claimed, when derivable. */
  earnedAt: number | null;
  /** Human-readable "how to get / how it was earned" line. */
  hint: string;
}

/**
 * Derive the provenance of one cosmetic. Missing evidence degrades honestly:
 * `earnedAt` stays null and the hint explains the unlock condition instead.
 */
export function cosmeticProvenance(
  def: CosmeticDef,
  progression: CosmeticProgression,
  settings: Record<string, unknown>,
  evidence: ProvenanceEvidence = {},
): CosmeticProvenance {
  switch (def.unlock.type) {
    case 'default':
      return { owned: true, source: 'default', earnedAt: null, hint: 'Unlocked by default.' };
    case 'purchase': {
      const earnedAt =
        evidence.ledgerByOperation?.get(`cosmetic:${def.id}`) ?? null;
      return {
        owned: isCosmeticOwned(def, progression, settings),
        source: 'purchase',
        earnedAt,
        hint: `Buy with ${def.price ?? 0} earned coins.`,
      };
    }
    case 'achievement': {
      const unlock = evidence.achievementUnlocks?.get(def.unlock.achievementId);
      const earnedAt = unlock?.claimedAt ?? null;
      return {
        owned: isCosmeticOwned(def, progression, settings),
        source: 'achievement',
        earnedAt,
        hint: `Earned by unlocking achievement "${def.unlock.achievementId}".`,
      };
    }
    case 'quest': {
      const earnedAt = evidence.questClaims?.get(def.unlock.questId) ?? null;
      return {
        owned: isCosmeticOwned(def, progression, settings),
        source: 'quest',
        earnedAt,
        hint: `Earned by completing quest "${def.unlock.questId}".`,
      };
    }
    case 'streakMilestone': {
      const earnedAt = evidence.milestoneClaims?.get(`mil-${def.unlock.days}`) ?? null;
      return {
        owned: isCosmeticOwned(def, progression, settings),
        source: 'streak-milestone',
        earnedAt,
        hint: `Earned by reaching a ${def.unlock.days}-day streak.`,
      };
    }
  }
}
