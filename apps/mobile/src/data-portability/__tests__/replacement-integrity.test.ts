import { describe, expect, it } from '@jest/globals';

import { parseAndValidateBackup } from '../deserialize';
import { replaceWithRotation, sweepRotationLeftovers, type RotationFileSystem } from '../replacement';
import { buildEnvelope, emptyData, T0 } from './helpers';

const OLD = JSON.stringify(buildEnvelope(emptyData(), { createdAt: T0 }));
const NEW = JSON.stringify(buildEnvelope(emptyData(), { createdAt: T0 + 1 }));
const LIVE = 'backup.json';
const PREV = '.backup.json.prev';
const TEMP = '.backup.json.pending';

function filesystem(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial));
  const fs: RotationFileSystem = {
    exists: (name) => files.has(name),
    write: (name, text) => { files.set(name, text); },
    read: async (name) => {
      if (!files.has(name)) throw new Error('ENOENT');
      return files.get(name)!;
    },
    move: async (from, to) => {
      if (files.has(to)) throw new Error('EEXIST');
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    delete: (name) => { files.delete(name); },
    listNames: () => [...files.keys()],
  };
  return { fs, files };
}

function expectBackup(text: string | undefined, expected: string) {
  expect(text).toBe(expected);
  expect(() => parseAndValidateBackup(text!)).not.toThrow();
}

describe('replacement backup integrity and restart recovery (D05)', () => {
  const invalidData = JSON.stringify(buildEnvelope({ ...emptyData(), gameSessions: [0] }));
  const badChecksum = OLD.replace('"createdAt":1700000000000', '"createdAt":1700000000002');
  const unsupported = JSON.stringify(buildEnvelope(emptyData(), { version: 999 }));

  it.each([
    ['nonempty truncated JSON', '{"format":'],
    ['non-backup JSON', '{"hello":"world"}'],
    ['checksum mismatch', badChecksum],
    ['checksummed invalid data', invalidData],
    ['unsupported backup version', unsupported],
  ])('restores a validated previous backup beside %s', async (_label, broken) => {
    expect(() => parseAndValidateBackup(broken)).toThrow();
    const { fs, files } = filesystem({ [LIVE]: broken, [PREV]: OLD });
    expect(await sweepRotationLeftovers(fs)).toEqual([]);
    expectBackup(files.get(LIVE), OLD);
    expect(files.has(PREV)).toBe(false);
    expect(await sweepRotationLeftovers(fs)).toEqual([]);
  });

  it('does not promote or consume an invalid previous backup', async () => {
    const { fs, files } = filesystem({ [LIVE]: '{"format":', [PREV]: badChecksum, [TEMP]: NEW });
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV, TEMP]);
    expect(files.get(PREV)).toBe(badChecksum);
    expect(files.get(LIVE)).toBe('{"format":');
    expectBackup(files.get(TEMP), NEW);
  });

  it('keeps and reports the only complete temp beside a truncated live file', async () => {
    const { fs, files } = filesystem({ [LIVE]: '{"format":', [TEMP]: NEW });
    expect(await sweepRotationLeftovers(fs)).toEqual([TEMP]);
    expectBackup(files.get(TEMP), NEW);
  });

  it('does not erase a previous copy during a failed recovery write', async () => {
    const { fs, files } = filesystem({ [LIVE]: '{"format":', [PREV]: OLD, [TEMP]: NEW });
    fs.write = (name, _text) => {
      files.set(name, '{"format":');
      throw new Error('ENOSPC during copy');
    };
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV, TEMP]);
    expectBackup(files.get(PREV), OLD);
    expectBackup(files.get(TEMP), NEW);
  });

  it('checks restored bytes before removing the recovery source (silent short copy)', async () => {
    const { fs, files } = filesystem({ [PREV]: OLD });
    const write = fs.write;
    fs.write = (name, _text) => { write(name, '{"format":'); };
    // Also sabotage move: either possible native copy fallback must not consume
    // the source before verification. This is a negative control for the old move.
    fs.move = async (from, to) => { files.set(to, '{"format":'); files.delete(from); };
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV]);
    expectBackup(files.get(PREV), OLD);
  });

  it('retains both artifacts when reading the restored destination fails', async () => {
    const { fs, files } = filesystem({ [PREV]: OLD, [TEMP]: NEW });
    const read = fs.read;
    fs.read = async (name) => {
      if (name === LIVE) throw new Error('EACCES');
      return read(name);
    };
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV, TEMP]);
    expectBackup(files.get(PREV), OLD);
    expectBackup(files.get(TEMP), NEW);
  });

  it('refuses to rotate over an unresolved complete previous copy', async () => {
    const { fs, files } = filesystem({ [LIVE]: '{"format":', [PREV]: OLD });
    fs.write = () => { throw new Error('EACCES'); };
    await expect(replaceWithRotation(fs, LIVE, NEW)).rejects.toThrow();
    expectBackup(files.get(PREV), OLD);
  });

  it('keeps a complete first-write temp after a copy fallback fails partway', async () => {
    const { fs, files } = filesystem({});
    fs.move = async (_from, to) => {
      files.set(to, '{"format":'); // source still exists: interrupted copy
      throw new Error('ENOSPC in move fallback');
    };
    await expect(replaceWithRotation(fs, LIVE, NEW)).rejects.toThrow('ENOSPC in move fallback');
    expectBackup(files.get(TEMP), NEW);
    expect(await sweepRotationLeftovers(fs)).toEqual([TEMP]);
  });

  it('does not consume the old live backup until the rotation copy is verified', async () => {
    const { fs, files } = filesystem({ [LIVE]: OLD });
    const write = fs.write;
    fs.write = (name, text) => { write(name, name === PREV ? '{"format":' : text); };
    fs.move = async (from, to) => {
      files.set(to, '{"format":');
      files.delete(from);
    };
    await expect(replaceWithRotation(fs, LIVE, NEW)).rejects.toThrow();
    expectBackup(files.get(LIVE), OLD);
  });

  it('a caught failed replacement restores the old backup without consuming it on short restore', async () => {
    const { fs, files } = filesystem({ [LIVE]: OLD });
    const write = fs.write;
    fs.write = (name, text) => { write(name, name === LIVE ? '{"format":' : text); };
    fs.move = async (from, to) => {
      files.set(to, '{"format":');
      files.delete(from);
      throw new Error('original copy failure');
    };
    await expect(replaceWithRotation(fs, LIVE, NEW)).rejects.toThrow('original copy failure');
    expectBackup(files.get(PREV), OLD);
  });

  it.each([
    ['partial rotation copy', { [LIVE]: OLD, [PREV]: '{"format":', [TEMP]: NEW }],
    ['completed rotation before install', { [PREV]: OLD, [TEMP]: NEW }],
    ['interrupted install copy fallback', { [LIVE]: '{"format":', [PREV]: OLD, [TEMP]: NEW }],
    ['completed install before cleanup', { [LIVE]: NEW, [PREV]: OLD, [TEMP]: NEW }],
  ])('repairs a fresh-process snapshot: %s', async (_label, snapshot) => {
    const { fs, files } = filesystem(snapshot);
    expect(await sweepRotationLeftovers(fs)).toEqual([]);
    const restored = files.get(LIVE)!;
    expect([OLD, NEW]).toContain(restored);
    expect(() => parseAndValidateBackup(restored)).not.toThrow();
    expect([...files.keys()]).toEqual([LIVE]);
  });

  it('does not consume an unreadable previous source or the only complete temp', async () => {
    const { fs, files } = filesystem({ [PREV]: OLD, [TEMP]: NEW });
    const read = fs.read;
    fs.read = async (name) => {
      if (name === PREV) throw new Error('EACCES');
      return read(name);
    };
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV, TEMP]);
    expectBackup(files.get(PREV), OLD);
    expectBackup(files.get(TEMP), NEW);
    expect(files.has(LIVE)).toBe(false);
  });

  it('does not replace a complete backup with checksum-invalid incoming bytes', async () => {
    const { fs, files } = filesystem({ [LIVE]: OLD });
    await expect(replaceWithRotation(fs, LIVE, badChecksum)).rejects.toThrow(/checksum/i);
    expectBackup(files.get(LIVE), OLD);
    expect(files.has(TEMP)).toBe(false);
  });

  it('retains an existing sole temp instead of overwriting it on a later write', async () => {
    const { fs, files } = filesystem({ [LIVE]: '{"format":', [TEMP]: OLD });
    await expect(replaceWithRotation(fs, LIVE, NEW)).rejects.toThrow(/retained/);
    expectBackup(files.get(TEMP), OLD);
  });

  it('keeps the previous source if restored bytes are valid but not the expected backup', async () => {
    const { fs, files } = filesystem({ [PREV]: OLD });
    fs.write = (name, _text) => { files.set(name, NEW); };
    expect(await sweepRotationLeftovers(fs)).toEqual([PREV]);
    expectBackup(files.get(PREV), OLD);
    expectBackup(files.get(LIVE), NEW);
  });

  it('reclaims alternatives only after a complete validated live backup exists', async () => {
    const { fs, files } = filesystem({ [LIVE]: NEW, [PREV]: OLD, [TEMP]: OLD });
    expect(await sweepRotationLeftovers(fs)).toEqual([]);
    expect([...files.keys()]).toEqual([LIVE]);
    expectBackup(files.get(LIVE), NEW);
  });
});
