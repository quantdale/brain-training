/**
 * Streak inventory (campaign 003, WP-3B, constitution §18).
 *
 * Item counts persist inside the profile `settings_json` under the
 * namespaced `settings.streaks` key as `{freeze, shield, recovery}`.
 * Every helper here is a PURE settings transform: it takes the current
 * settings object and returns the next one, preserving all unrelated keys —
 * the caller persists the result via `db.profile.update({settings})` (which
 * merges, never replaces wholesale). No db writes happen in this module.
 */

import type { StreakInventory, StreakItemKind } from './types';

/** Clamp an unknown count value to a sane non-negative integer (0 for garbage). */
function normalizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/** Tolerant read of the raw `streaks` settings block (missing/garbage → {}). */
function readStreaksBlock(settings: Record<string, unknown>): Record<string, unknown> {
  const block = settings.streaks;
  return block && typeof block === 'object' ? (block as Record<string, unknown>) : {};
}

/**
 * Read the player's item inventory from the profile settings object.
 * Tolerant: a missing block, missing keys, non-numeric values, negative and
 * fractional counts all normalize to 0.
 */
export function readInventory(profileSettings: Record<string, unknown>): StreakInventory {
  const block = readStreaksBlock(profileSettings);
  return {
    freeze: normalizeCount(block.freeze),
    shield: normalizeCount(block.shield),
    recovery: normalizeCount(block.recovery),
  };
}

/**
 * Add item counts (e.g. a purchase or reward) and return the next settings
 * object. Garbage item values are clamped to 0; unrelated settings keys and
 * the `freezeUsed` sub-key are preserved. The input object is not mutated.
 */
export function grantItems(
  settings: Record<string, unknown>,
  items: Partial<StreakInventory>,
): Record<string, unknown> {
  const block = readStreaksBlock(settings);
  const current = readInventory(settings);
  return {
    ...settings,
    streaks: {
      ...block,
      freeze: current.freeze + normalizeCount(items.freeze),
      shield: current.shield + normalizeCount(items.shield),
      recovery: current.recovery + normalizeCount(items.recovery),
    },
  };
}

/**
 * Consume one item and return the next settings object. The count floors at
 * 0 (consuming an empty inventory is a no-op); unrelated settings keys and
 * the `freezeUsed` sub-key are preserved. The input object is not mutated.
 */
export function consumeItem(
  settings: Record<string, unknown>,
  kind: StreakItemKind,
): Record<string, unknown> {
  const block = readStreaksBlock(settings);
  const current = readInventory(settings);
  return {
    ...settings,
    streaks: {
      ...block,
      freeze: current.freeze,
      shield: current.shield,
      recovery: current.recovery,
      [kind]: Math.max(0, current[kind] - 1),
    },
  };
}
