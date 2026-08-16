/**
 * Content-pack versioning + storage seam (constitution §24) — public API.
 *
 * Consumers (settings/storage UI, future download manager) import from here
 * only; internals may change without API churn.
 */
export type { PackInfo, StorageSummary } from './types';
export { estimatePackSizeBytes, getBundledPacks, getPack, getStorageSummary } from './registry';
export { clearPackCache, estimatedPackSizeBytes, listInstalledPacks } from './storage';
export type { ClearPackResult } from './storage';
