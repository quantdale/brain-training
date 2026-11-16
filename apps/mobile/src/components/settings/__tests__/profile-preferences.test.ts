import { describe, expect, it } from '@jest/globals';
import { enqueuePreferenceWrite, preferenceChangesBlocked, withAuthoritativePreferences } from '../profile-preferences';

describe('profile preference writer lane', () => {
  it('drains failed writes, reserves synchronously, and unblocks after a failed restore', async () => {
    const failedWrite = enqueuePreferenceWrite(async () => { throw new Error('write failed'); });
    const restore = withAuthoritativePreferences(async () => { throw new Error('restore failed'); });
    expect(preferenceChangesBlocked()).toBe(true);
    let blockedWriteRan = false;
    await enqueuePreferenceWrite(async () => { blockedWriteRan = true; });
    await expect(failedWrite).rejects.toThrow('write failed');
    await expect(restore).rejects.toThrow('restore failed');
    expect(blockedWriteRan).toBe(false);
    expect(preferenceChangesBlocked()).toBe(false);
    let nextWriteRan = false;
    await enqueuePreferenceWrite(async () => { nextWriteRan = true; });
    expect(nextWriteRan).toBe(true);
  });
});
