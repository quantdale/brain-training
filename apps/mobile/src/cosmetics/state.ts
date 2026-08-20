/**
 * Pure cosmetics state resolution (engagement-cosmetics wave). No db access:
 * every helper transforms the profile `settings` object or derives ownership
 * from a `CosmeticProgression`. The UI persists results via `db.profile.update`
 * (which merges settings) and the economy `purchaseCosmetic`.
 */
import type {
  CosmeticDef,
  CosmeticProgression,
  CosmeticSettings,
  CosmeticSlot,
} from './types';
import { COSMETIC_SLOTS } from './types';

const EMPTY: CosmeticSettings = { owned: [], equipped: {} };

/** Tolerant read of the `cosmetics` settings block. */
export function readCosmeticSettings(settings: Record<string, unknown>): CosmeticSettings {
  const block = settings.cosmetics;
  if (!block || typeof block !== 'object') {
    return EMPTY;
  }
  const b = block as Record<string, unknown>;
  const owned = Array.isArray(b.owned)
    ? b.owned.filter((value): value is string => typeof value === 'string')
    : [];
  const equippedRaw = (b.equipped ?? {}) as Record<string, unknown>;
  const equipped: Partial<Record<CosmeticSlot, string>> = {};
  for (const slot of COSMETIC_SLOTS) {
    const value = equippedRaw[slot];
    if (typeof value === 'string') {
      equipped[slot] = value;
    }
  }
  return { owned, equipped };
}

/** Whether a cosmetic is owned, given progression + persisted purchase state. */
export function isCosmeticOwned(
  def: CosmeticDef,
  progression: CosmeticProgression,
  settings: Record<string, unknown>,
): boolean {
  switch (def.unlock.type) {
    case 'default':
      return true;
    case 'purchase':
      return readCosmeticSettings(settings).owned.includes(def.id);
    case 'achievement':
      return progression.claimedAchievements.has(def.unlock.achievementId);
    case 'quest':
      return progression.claimedQuests.has(def.unlock.questId);
    case 'streakMilestone':
      return progression.longestStreak >= def.unlock.days;
  }
}

/** PURE settings transform: record a purchased cosmetic as owned (idempotent). */
export function grantOwned(
  settings: Record<string, unknown>,
  id: string,
): Record<string, unknown> {
  const current = readCosmeticSettings(settings);
  if (current.owned.includes(id)) {
    return settings;
  }
  return {
    ...settings,
    cosmetics: { ...asCosmeticsBlock(settings), owned: [...current.owned, id] },
  };
}

/** PURE settings transform: equip a cosmetic into its slot (idempotent). */
export function equipCosmetic(
  settings: Record<string, unknown>,
  slot: CosmeticSlot,
  id: string,
): Record<string, unknown> {
  const current = readCosmeticSettings(settings);
  return {
    ...settings,
    cosmetics: {
      ...asCosmeticsBlock(settings),
      equipped: { ...current.equipped, [slot]: id },
    },
  };
}

/** The default (always-owned) cosmetic for a slot. */
export function defaultForSlot(
  definitions: readonly CosmeticDef[],
  slot: CosmeticSlot,
): CosmeticDef | undefined {
  return definitions.find((def) => def.slot === slot && def.unlock.type === 'default');
}

/**
 * Resolve the equipped cosmetic per slot, falling back to the slot's default
 * when nothing is equipped or the equipped id is not owned.
 */
export function resolveEquipped(
  definitions: readonly CosmeticDef[],
  settings: Record<string, unknown>,
  progression: CosmeticProgression,
): Partial<Record<CosmeticSlot, CosmeticDef>> {
  const current = readCosmeticSettings(settings);
  const result: Partial<Record<CosmeticSlot, CosmeticDef>> = {};
  for (const slot of COSMETIC_SLOTS) {
    const id = current.equipped[slot];
    const def = id ? definitions.find((d) => d.id === id) : undefined;
    const owned = def ? isCosmeticOwned(def, progression, settings) : false;
    result[slot] = owned ? def : defaultForSlot(definitions, slot);
  }
  return result;
}

/** Spread the existing `cosmetics` block (or empty) for a settings merge. */
function asCosmeticsBlock(settings: Record<string, unknown>): Record<string, unknown> {
  const block = settings.cosmetics;
  return block && typeof block === 'object' ? { ...(block as Record<string, unknown>) } : {};
}
