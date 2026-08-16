/**
 * Content-pack storage scaffold tests — the seam is a documented no-op today
 * (all packs are bundled), so these tests pin the no-op shapes that callers
 * (future Settings/storage UI) must be able to rely on.
 */

// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { getBundledPacks, getPack } from '../registry';
import { clearPackCache, estimatedPackSizeBytes, listInstalledPacks } from '../storage';

describe('content-pack storage scaffold', () => {
  it('listInstalledPacks resolves to the bundled packs (no-op persistence)', async () => {
    await expect(listInstalledPacks()).resolves.toEqual(getBundledPacks());
    // Deterministic across calls.
    expect(await listInstalledPacks()).toEqual(await listInstalledPacks());
  });

  it('clearPackCache always reports the documented not-implemented no-op', async () => {
    // Known and unknown ids alike — nothing is clearable while all packs are bundled.
    const knownId = getBundledPacks()[0].packId;
    await expect(clearPackCache(knownId)).resolves.toEqual({
      cleared: false,
      reason: 'not-implemented',
    });
    await expect(clearPackCache('unknown-pack')).resolves.toEqual({
      cleared: false,
      reason: 'not-implemented',
    });
  });

  it('estimatedPackSizeBytes returns the registry estimate for known packs', async () => {
    const knownId = getBundledPacks()[0].packId;
    await expect(estimatedPackSizeBytes(knownId)).resolves.toBe(
      getPack(knownId)?.sizeEstimateBytes,
    );
  });

  it('estimatedPackSizeBytes returns null for unknown packs', async () => {
    await expect(estimatedPackSizeBytes('unknown-pack')).resolves.toBeNull();
    await expect(estimatedPackSizeBytes('')).resolves.toBeNull();
  });
});
