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

  it('suffixes repeated names within the same clock second (-2, -3) so an earlier backup is never overwritten', () => {
    const at = new Date(2026, 7, 20, 9, 5, 4);
    expect(defaultBackupName(at)).toBe('brain-training-backup_2026-08-20_09-05-04.json');
    expect(defaultBackupName(at)).toBe('brain-training-backup_2026-08-20_09-05-04-2.json');
    expect(defaultBackupName(at)).toBe('brain-training-backup_2026-08-20_09-05-04-3.json');
  });

  it('skips names already present in the supplied inventory', () => {
    const at = new Date(2026, 7, 20, 9, 5, 5);
    const base = 'brain-training-backup_2026-08-20_09-05-05.json';
    expect(defaultBackupName(at, [base])).toBe(
      'brain-training-backup_2026-08-20_09-05-05-2.json',
    );
  });

  it('keeps the plain name when the timestamp advances (spaced-out exports)', () => {
    expect(defaultBackupName(new Date(2026, 7, 20, 9, 5, 6))).toBe(
      'brain-training-backup_2026-08-20_09-05-06.json',
    );
    expect(defaultBackupName(new Date(2026, 7, 20, 9, 5, 7))).toBe(
      'brain-training-backup_2026-08-20_09-05-07.json',
    );
  });
});
