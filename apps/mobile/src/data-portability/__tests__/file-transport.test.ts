/**
 * FileBackupTransport seam tests (campaign 011, W12).
 *
 * `file-transport.ts` owns the real device-storage wiring: expo-file-system
 * (SDK 57 object-oriented API), the system document picker, and the share
 * sheet. These tests pin its SEMANTICS against in-memory doubles of those
 * native modules:
 *
 *   - write/read/list/delete round-trips inside a dedicated backups folder;
 *   - overwrite replaces content and never duplicates the listing;
 *   - missing-name reads throw; missing-name deletes are no-ops;
 *   - picker cancel resolves null; picked files are read from their URI;
 *   - share unavailability degrades to `false`; missing files throw.
 *
 * Real device flows (SAF quirks, permissions) belong to the parent's device
 * pass — per packet W12 this file owns the mocked seam only.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import {
  createFileBackupTransport,
  pickBackupFile,
  shareBackupFile,
} from '../file-transport';
import { MAX_BACKUP_TEXT_LENGTH } from '../deserialize';

/* ------------------------------------------------------------------ */
/* In-memory expo-file-system double                                   */
/* ------------------------------------------------------------------ */

interface MockEntry {
  kind: 'dir' | 'file';
  content?: string;
}

/** `mock*` prefix keeps jest.mock factories allowed to close over these. */
const mockStore = new Map<string, MockEntry>();

/** Number of times the mocked expo File.text() was invoked (pre-read proofs). */
let mockTextReads = 0;

/**
 * One-shot storage fault injected through the mocked native seam. `op` selects
 * the failing call (a fresh write vs. the atomic overwrite move); the fault is
 * consumed so a single test can prove both propagation and recovery.
 */
let mockFsFault: { op: 'write' | 'move'; error: Error } | null = null;

function mockJoinUri(parent: string, name: string): string {
  return `${parent.replace(/\/+$/, '')}/${name}`;
}
function mockBaseName(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

jest.mock('expo-file-system', () => {
  const Paths = { document: { uri: 'file:///mock-documents' } };

  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      // Join whenever a child name is given; a bare string parent with no
      // name is an absolute URI (e.g. `new File(asset.uri)`).
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name === undefined ? base : mockJoinUri(base, name);
    }
    get name(): string {
      return mockBaseName(this.uri);
    }
    get exists(): boolean {
      return mockStore.get(this.uri)?.kind === 'dir';
    }
    create(_opts?: unknown): void {
      mockStore.set(this.uri, { kind: 'dir' });
    }
    list(): (File | Directory)[] {
      const out: (File | Directory)[] = [];
      for (const [uri, entry] of mockStore) {
        if (!uri.startsWith(`${this.uri}/`) || entry.kind !== 'file') continue;
        if (uri.slice(this.uri.length + 1).includes('/')) continue; // nested dirs skipped
        out.push(new File(this, mockBaseName(uri)));
      }
      return out;
    }
  }

  class File extends Directory {
    // `exists` must reflect FILE entries specifically.
    get exists(): boolean {
      return mockStore.get(this.uri)?.kind === 'file';
    }
    write(contents: string): void {
      if (mockFsFault?.op === 'write') {
        const { error } = mockFsFault;
        mockFsFault = null;
        throw error;
      }
      mockStore.set(this.uri, { kind: 'file', content: contents });
    }
    text(): string {
      mockTextReads += 1;
      const entry = mockStore.get(this.uri);
      if (!entry || entry.kind !== 'file') {
        throw new Error(`ENOENT: no such file "${this.uri}"`);
      }
      return entry.content as string;
    }
    delete(): void {
      mockStore.delete(this.uri);
    }
    async move(destination: File, options?: { overwrite?: boolean }): Promise<void> {
      if (mockFsFault?.op === 'move') {
        const { error } = mockFsFault;
        mockFsFault = null;
        throw error;
      }
      const entry = mockStore.get(this.uri);
      if (!entry || entry.kind !== 'file') {
        throw new Error(`ENOENT: no such file "${this.uri}"`);
      }
      if (mockStore.has(destination.uri) && !options?.overwrite) {
        throw new Error(`EEXIST: file already exists "${destination.uri}"`);
      }
      mockStore.set(destination.uri, entry);
      mockStore.delete(this.uri);
      this.uri = destination.uri;
    }
  }

  return { Directory, File, Paths };
});

type MockPickerResult = {
  canceled: boolean;
  assets: { uri: string; name: string; size?: number }[];
};

const mockGetDocumentAsync = jest.fn(
  (): Promise<MockPickerResult> => Promise.resolve({ canceled: true, assets: [] }),
);
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (
    ...args: Parameters<typeof mockGetDocumentAsync>
  ) => mockGetDocumentAsync(...args),
}));

const mockIsAvailableAsync = jest.fn((): Promise<boolean> => Promise.resolve(false));
const mockShareAsync = jest.fn(
  (_uri: string, _options?: Record<string, unknown>): Promise<void> => Promise.resolve(),
);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (
    ...args: Parameters<typeof mockIsAvailableAsync>
  ) => mockIsAvailableAsync(...args),
  shareAsync: (...args: Parameters<typeof mockShareAsync>) => mockShareAsync(...args),
}));

beforeEach(() => {
  mockStore.clear();
  mockTextReads = 0;
  mockFsFault = null;
  mockGetDocumentAsync.mockReset();
  mockIsAvailableAsync.mockReset();
  mockShareAsync.mockReset();
});

describe('createFileBackupTransport (mocked expo-file-system)', () => {
  it('write/read/list/delete round-trips and auto-creates the backups dir', async () => {
    // listBackups()/writeBackup() lazily create the folder (ensureBackupDirectory),
    // so the "not created yet" assertion must precede any transport call.
    expect(mockStore.has('file:///mock-documents/backups')).toBe(false);

    const t = createFileBackupTransport();
    expect(await t.listBackups()).toEqual([]);
    expect(mockStore.has('file:///mock-documents/backups')).toBe(true); // created by listing

    await t.writeBackup('b1.json', 'one');
    await t.writeBackup('b2.json', 'two');
    expect((await t.listBackups()).sort()).toEqual(['b1.json', 'b2.json']);
    expect(await t.readBackup('b1.json')).toBe('one');

    await t.deleteBackup('b2.json');
    expect(await t.listBackups()).toEqual(['b1.json']);
  });

  it('overwrite replaces content and keeps a single listing entry', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('same.json', 'first');
    await t.writeBackup('same.json', 'second');

    expect(await t.readBackup('same.json')).toBe('second');
    expect(await t.listBackups()).toEqual(['same.json']);
  });

  it('read of a missing name throws with a readable message', async () => {
    const t = createFileBackupTransport();
    await expect(t.readBackup('nope.json')).rejects.toThrow(/No backup named "nope\.json"/);
  });

  it('delete of a missing name is a no-op', async () => {
    const t = createFileBackupTransport();
    await expect(t.deleteBackup('ghost.json')).resolves.toBeUndefined();
  });

  it('rejects path traversal names before touching storage', async () => {
    const t = createFileBackupTransport();
    await expect(t.writeBackup('../escape.json', 'bad')).rejects.toThrow(/file name inside/);
    await expect(t.readBackup('nested/backup.json')).rejects.toThrow(/file name inside/);
    await expect(t.deleteBackup('..')).rejects.toThrow(/file name inside/);
  });

  it('listBackups orders newest-first (descending names)', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('brain-training-backup_2026-08-20_09-00-00.json', 'a');
    await t.writeBackup('brain-training-backup_2026-08-21_10-00-00.json', 'b');
    expect(await t.listBackups()).toEqual([
      'brain-training-backup_2026-08-21_10-00-00.json',
      'brain-training-backup_2026-08-20_09-00-00.json',
    ]);
  });
});

describe('write failures (mocked ENOSPC/EACCES)', () => {
  const BACKUPS_DIR = 'file:///mock-documents/backups';

  it('surfaces the storage error verbatim and never reports a successful export', async () => {
    const t = createFileBackupTransport();
    const fault = Object.assign(new Error('ENOSPC: no space left on device'), {
      code: 'ENOSPC',
    });
    mockFsFault = { op: 'write', error: fault };

    let caught: unknown;
    try {
      await t.writeBackup('doomed.json', '{"export":true}');
    } catch (error) {
      caught = error;
    }

    // The caller receives the ORIGINAL typed failure — not swallowed and not
    // re-wrapped into a generic message.
    expect(caught).toBe(fault);
    // No in-memory export exists: no destination file, no listing entry, and
    // no orphaned temp file.
    expect(mockStore.has(`${BACKUPS_DIR}/doomed.json`)).toBe(false);
    expect(await t.listBackups()).toEqual([]);
    expect(
      [...mockStore.keys()].filter((uri) => uri.includes('.tmp')),
    ).toEqual([]);
  });

  it('keeps the previous complete backup when the overwrite move fails (EACCES)', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('keep.json', 'old-complete');
    const fault = Object.assign(new Error('EACCES: permission denied'), {
      code: 'EACCES',
    });
    mockFsFault = { op: 'move', error: fault };

    await expect(t.writeBackup('keep.json', 'new-partial')).rejects.toBe(fault);

    // Atomicity contract: the prior complete backup is untouched, listed
    // exactly once, and the failed write's temp file was cleaned up.
    expect(await t.readBackup('keep.json')).toBe('old-complete');
    expect((await t.listBackups()).filter((name) => name === 'keep.json')).toHaveLength(
      1,
    );
    expect(
      [...mockStore.keys()].filter((uri) => uri.includes('.tmp')),
    ).toEqual([]);
  });
});

describe('pickBackupFile (mocked expo-document-picker)', () => {
  it('resolves null when the user cancels the picker', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    await expect(pickBackupFile()).resolves.toBeNull();
    expect(mockGetDocumentAsync).toHaveBeenCalledTimes(1);
  });

  it('reads the picked file text from its URI', async () => {
    mockStore.set('file:///cache/picked.json', { kind: 'file', content: '{"format":"x"}' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/picked.json', name: 'picked.json' }],
    });
    await expect(pickBackupFile()).resolves.toEqual({
      name: 'picked.json',
      text: '{"format":"x"}',
    });
  });

  it('throws when the picked URI cannot be opened', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/vanished.json', name: 'vanished.json' }],
    });
    await expect(pickBackupFile()).rejects.toThrow(/could not be opened/);
  });

  it('rejects an oversized picked asset BEFORE reading its text', async () => {
    // The file itself is readable; only the picker-reported size is hostile.
    // The guard must fire before `file.text()` ever materializes the document.
    mockStore.set('file:///cache/huge.json', { kind: 'file', content: '{}' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/huge.json',
          name: 'huge.json',
          size: MAX_BACKUP_TEXT_LENGTH + 1,
        },
      ],
    });

    await expect(pickBackupFile()).rejects.toThrow(/too large/i);
    expect(mockTextReads).toBe(0);
  });

  it('still reads an asset whose reported size is within the cap', async () => {
    mockStore.set('file:///cache/ok.json', { kind: 'file', content: '{"format":"x"}' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///cache/ok.json', name: 'ok.json', size: MAX_BACKUP_TEXT_LENGTH },
      ],
    });

    await expect(pickBackupFile()).resolves.toEqual({
      name: 'ok.json',
      text: '{"format":"x"}',
    });
    expect(mockTextReads).toBe(1);
  });
});

describe('shareBackupFile (mocked expo-sharing)', () => {
  it('throws for a genuinely missing backup', async () => {
    await expect(shareBackupFile('missing.json')).rejects.toThrow(
      /No backup named "missing\.json"/,
    );
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
  });

  it('returns false without opening the share sheet when sharing is unavailable', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('b.json', 'content');
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(shareBackupFile('b.json')).resolves.toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('hands the saved file URI to the share sheet when available', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('b.json', 'content');
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    await expect(shareBackupFile('b.json', 'Send it')).resolves.toBe(true);
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///mock-documents/backups/b.json',
      expect.objectContaining({ dialogTitle: 'Send it' }),
    );
  });
});
