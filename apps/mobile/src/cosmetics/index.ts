/**
 * Cosmetics engine (engagement-cosmetics wave, constitution §20/§33):
 * expanded registry, pure ownership/equip resolution, and idempotent economy.
 */
export type {
  CosmeticDef,
  CosmeticSlot,
  CosmeticUnlock,
  CosmeticProgression,
  CosmeticSettings,
} from './types';
export { COSMETIC_SLOTS } from './types';
export { COSMETIC_DEFINITIONS, getCosmeticDefinition } from './registry';
export {
  readCosmeticSettings,
  isCosmeticOwned,
  grantOwned,
  equipCosmetic,
  defaultForSlot,
  resolveEquipped,
} from './state';
export { purchaseCosmetic, equipCosmeticPersisted } from './store';
export type { PurchaseCosmeticResult } from './store';
