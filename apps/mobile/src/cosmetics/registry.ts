/**
 * Expanded cosmetic registry (engagement-cosmetics wave).
 *
 * Catalog of safe, non-pay-to-win cosmetics across three slots:
 * - `avatarFrame`: a colored ring/emoji shown around the profile avatar.
 * - `accent`: an accent color used by celebration/avatar surfaces.
 * - `celebration`: the celebratory flourish shown when a reward is claimed.
 *
 * Unlock rules mix defaults, purchases (normal earned currency only), and
 * earned unlocks tied to achievements / quests / streak milestones, so the
 * catalog is a meaningful reward layer rather than a store. IDs are canonical.
 */
import type { CosmeticDef } from './types';

export const COSMETIC_DEFINITIONS: readonly CosmeticDef[] = [
  // ---- Avatar frames ----
  Object.freeze({
    id: 'cos-frame-default',
    name: 'Classic Ring',
    slot: 'avatarFrame',
    description: 'The default avatar frame.',
    unlock: { type: 'default' },
    preview: { emoji: '🟦', color: '#4F6BFF' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-frame-bronze',
    name: 'Bronze Ring',
    slot: 'avatarFrame',
    description: 'Earned by completing 25 sessions.',
    unlock: { type: 'achievement', achievementId: 'ach-25' },
    preview: { emoji: '🥉', color: '#CD7F32' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-frame-silver',
    name: 'Silver Ring',
    slot: 'avatarFrame',
    description: 'Earned by a 30-day streak.',
    unlock: { type: 'streakMilestone', days: 30 },
    preview: { emoji: '🥈', color: '#C0C6D4' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-frame-gold',
    name: 'Gold Ring',
    slot: 'avatarFrame',
    description: 'Earned by completing 100 sessions.',
    unlock: { type: 'achievement', achievementId: 'ach-100' },
    preview: { emoji: '🥇', color: '#E6B800' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-frame-azure',
    name: 'Azure Ring',
    slot: 'avatarFrame',
    description: 'Buy with earned coins.',
    unlock: { type: 'purchase' },
    price: 150,
    preview: { emoji: '🟪', color: '#6C5CE7' },
  } satisfies CosmeticDef),

  // ---- Accents ----
  Object.freeze({
    id: 'cos-accent-indigo',
    name: 'Indigo',
    slot: 'accent',
    description: 'The default accent color.',
    unlock: { type: 'default' },
    preview: { color: '#4F6BFF' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-accent-amber',
    name: 'Amber',
    slot: 'accent',
    description: 'Earned by a 3-day streak.',
    unlock: { type: 'streakMilestone', days: 3 },
    preview: { color: '#F0B13C' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-accent-rose',
    name: 'Rose',
    slot: 'accent',
    description: 'Earned by a 100-day streak.',
    unlock: { type: 'streakMilestone', days: 100 },
    preview: { color: '#F16B7C' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-accent-emerald',
    name: 'Emerald',
    slot: 'accent',
    description: 'Buy with earned coins.',
    unlock: { type: 'purchase' },
    price: 200,
    preview: { color: '#1E9E62' },
  } satisfies CosmeticDef),

  // ---- Celebrations ----
  Object.freeze({
    id: 'cos-celebrate-classic',
    name: 'Classic',
    slot: 'celebration',
    description: 'The default celebration.',
    unlock: { type: 'default' },
    preview: { emoji: '🎉' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-celebrate-confetti',
    name: 'Confetti',
    slot: 'celebration',
    description: 'Earned by your first achievement.',
    unlock: { type: 'achievement', achievementId: 'ach-first' },
    preview: { emoji: '🎊' },
  } satisfies CosmeticDef),
  Object.freeze({
    id: 'cos-celebrate-fireworks',
    name: 'Fireworks',
    slot: 'celebration',
    description: 'Buy with earned coins.',
    unlock: { type: 'purchase' },
    price: 250,
    preview: { emoji: '🎆' },
  } satisfies CosmeticDef),
] as const;

/** Look up a cosmetic definition by id (canonical key). */
export function getCosmeticDefinition(id: string): CosmeticDef | undefined {
  return COSMETIC_DEFINITIONS.find((def) => def.id === id);
}
