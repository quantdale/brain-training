/**
 * Cosmetic model types (engagement-cosmetics wave, constitution §20/§33).
 *
 * Cosmetics are safe, non-pay-to-win rewards: they alter avatars/accents/
 * celebration flourishes only, never gameplay, readability, or ratings. They
 * are earned (achievements, quests, streak milestones), purchased with normal
 * earned currency (never bought with real money), or granted by default.
 *
 * Ownership is derived for earned cosmetics (no stored flag needed) and stored
 * for purchased ones (under `settings.cosmetics.owned`). Equip state lives
 * under `settings.cosmetics.equipped` — no schema change required (constitution
 * §17: profile settings are a merged JSON document).
 */
export type CosmeticSlot = 'avatarFrame' | 'accent' | 'celebration';

export type CosmeticUnlock =
  | { type: 'default' }
  | { type: 'purchase' }
  | { type: 'achievement'; achievementId: string }
  | { type: 'quest'; questId: string }
  | { type: 'streakMilestone'; days: number };

export interface CosmeticDef {
  id: string;
  name: string;
  slot: CosmeticSlot;
  description: string;
  unlock: CosmeticUnlock;
  /** Coins required when `unlock.type === 'purchase'`. */
  price?: number;
  /** Visual descriptor used by preview/UI (emoji + accent hex). */
  preview: { emoji?: string; color?: string };
  /** Whether the player can equip it (default true). */
  equippable?: boolean;
}

/**
 * Progression facts needed to decide earned-cosmetic ownership. Built by the
 * UI from the db (claimed achievements/quests, best streak).
 */
export interface CosmeticProgression {
  claimedAchievements: ReadonlySet<string>;
  claimedQuests: ReadonlySet<string>;
  longestStreak: number;
}

/** Persisted cosmetic state (subset of `settings.cosmetics`). */
export interface CosmeticSettings {
  owned: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
}

export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ['avatarFrame', 'accent', 'celebration'];
