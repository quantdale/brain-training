import { describe, expect, it } from '@jest/globals';
import { createMemoryTransport, defaultBackupName } from '../transport';

describe('BackupTransport (memory)', () => {
  it('write/read/list/delete round trips', async () => {
    const t = createMemoryTransport();
    expect(await t.listBackups()).toEqual([]);
    await t.writeBackup('b1.json', 'contents-1');
    await t.writeBackup('b2.json', 'contents-2');
    expect((await t.listBackups()).sort()).toEqual(['b1.json', 'b2.json']);
    expect(await t.readBackup('b1.json')).toBe('contents-1');
    await t.deleteBackup('b1.json');
    expect(await t.listBackups()).toEqual(['b2.json']);
  });

  it('throws on read of a missing backup', async () => {
    const t = createMemoryTransport();
    await expect(t.readBackup('nope.json')).rejects.toThrow(/No backup/);
  });

  it('deleteBackup is a no-op for missing names', async () => {
    const t = createMemoryTransport();
    await expect(t.deleteBackup('missing')).resolves.toBeUndefined();
  });
});

describe('defaultBackupName', () => {
  it('produces a stable filename with a date_time stamp', () => {
    const name = defaultBackupName(new Date(2026, 7, 20, 9, 5, 3));
    expect(name).toBe('brain-training-backup_2026-08-20_09-05-03.json');
  });
});
