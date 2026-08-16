import { describe, expect, it } from '@jest/globals';
import { ProfileRepository, LOCAL_PROFILE_ID } from '../profile';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

describe('profile repository', () => {
  it('creates the singleton profile on first access, and only once', async () => {
    const adapter = await createMigratedDb();
    let now = T0;
    const repo = new ProfileRepository(adapter, () => now);

    const first = await repo.ensureExists();
    expect(first).toEqual({
      id: LOCAL_PROFILE_ID,
      displayName: '',
      settings: {},
      createdAt: T0,
      updatedAt: T0,
    });

    now = T0 + 60_000;
    const second = await repo.ensureExists(); // idempotent
    expect(second.createdAt).toBe(T0);
    expect(second.updatedAt).toBe(T0); // untouched — ensureExists never bumps

    const rows = await adapter.all('SELECT * FROM profile');
    expect(rows).toHaveLength(1);
  });

  it('returns null before the profile exists', async () => {
    const adapter = await createMigratedDb();
    const repo = new ProfileRepository(adapter);
    expect(await repo.get()).toBeNull();
  });

  it('updates display name and merges settings, preserving created_at', async () => {
    const adapter = await createMigratedDb();
    let now = T0;
    const repo = new ProfileRepository(adapter, () => now);
    await repo.ensureExists();

    now = T0 + 1_000;
    const updated = await repo.update({ displayName: 'Alice', settings: { theme: 'dark' } });
    expect(updated).toEqual({
      id: LOCAL_PROFILE_ID,
      displayName: 'Alice',
      settings: { theme: 'dark' },
      createdAt: T0,
      updatedAt: T0 + 1_000,
    });

    now = T0 + 2_000;
    const merged = await repo.update({ settings: { soundOn: false } });
    expect(merged.settings).toEqual({ theme: 'dark', soundOn: false });
    expect(merged.displayName).toBe('Alice');
    expect(merged.createdAt).toBe(T0);
    expect(merged.updatedAt).toBe(T0 + 2_000);

    // Persisted, not just returned.
    expect((await repo.get())?.settings).toEqual({ theme: 'dark', soundOn: false });
  });

  it('update creates the row when absent', async () => {
    const adapter = await createMigratedDb();
    const repo = new ProfileRepository(adapter, () => T0);
    const created = await repo.update({ displayName: 'First' });
    expect(created.createdAt).toBe(T0);
    expect(created.displayName).toBe('First');
    expect(await repo.get()).not.toBeNull();
  });

  it('recovers gracefully from a corrupt settings payload', async () => {
    const adapter = await createMigratedDb();
    const repo = new ProfileRepository(adapter, () => T0);
    await repo.ensureExists();
    await adapter.run(
      "UPDATE profile SET settings_json = '{not json' WHERE id = ?",
      [LOCAL_PROFILE_ID],
    );
    expect((await repo.get())?.settings).toEqual({});
  });
});
