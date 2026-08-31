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

/* ------------------------------------------------------------------ */
/* In-memory expo-file-system double                                   */
/* ------------------------------------------------------------------ */

interface MockEntry {
  kind: 'dir' | 'file';
  content?: string;
}

/** `mock*` prefix keeps jest.mock factories allowed to close over these. */
const mockStore = new Map<string, MockEntry>();

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
      mockStore.set(this.uri, { kind: 'file', content: contents });
    }
    text(): string {
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
  assets: { uri: string; name: string }[];
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
