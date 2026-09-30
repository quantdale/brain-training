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
  isInternalBackupArtifact,
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
    // Content length in code units (062: stands in for the native byte
    // size for the ASCII fixtures used here; the seam under test only
    // needs a size signal, and byte-vs-char direction is documented in
    // the change notes).
    get size(): number {
      const entry = mockStore.get(this.uri);
      if (!entry || entry.kind !== 'file') {
        return 0;
      }
      return (entry.content as string).length;
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

  it('rejects names the listing could never show (R1 write/list symmetry)', async () => {
    const t = createFileBackupTransport();
    // Dotfiles and `*.tmp` partials are hidden by listBackups; a successful
    // write under such a name would be invisible in the restore list.
    //
    // 070: the two failure classes now have DISTINCT messages. "Not a file
    // name" and "structurally fine but unlistable" send a user to different
    // fixes, and collapsing them into one message is how a reserved name ends
    // up being retried forever.
    await expect(t.writeBackup('.hidden.json', '{}')).rejects.toThrow(/reserved for internal backup files/);
    await expect(t.writeBackup('run.tmp', '{}')).rejects.toThrow(/reserved for internal backup files/);
    await expect(t.readBackup('.hidden.json')).rejects.toThrow(/reserved for internal backup files/);
    await expect(t.deleteBackup('run.tmp')).rejects.toThrow(/reserved for internal backup files/);
    // The name in the message is what lets the user work out which of their
    // own filenames was the problem.
    await expect(t.writeBackup('.hidden.json', '{}')).rejects.toThrow(/".hidden.json"/);
    expect(await t.listBackups()).toEqual([]);
  });

  it('rejects structurally invalid names with the structural message', async () => {
    const t = createFileBackupTransport();
    for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'a\u0000b']) {
      await expect(t.writeBackup(bad, '{}')).rejects.toThrow(/file name inside/);
    }
    expect(await t.listBackups()).toEqual([]);
  });

  it('the write-time validator and the listing predicate agree on every class', async () => {
    // The two rules used to be written separately with the same intent, so they
    // could drift: a name the writer accepted but the lister hid was a backup
    // the app reported as saved and could never show. One predicate is used by
    // both; this proves the agreement across the classes that matter, rather
    // than trusting they were written from the same list.
    const t = createFileBackupTransport();
    const candidates = [
      'normal.json',
      'with space.json',
      'UPPER.JSON',
      'dots.in.the.middle.json',
      '.hidden.json',
      '..double.json',
      'trailing.tmp',
      '.tmp',
      'a.tmp.json',
      'name.tmp.tmp',
    ];
    for (const name of candidates) {
      const accepted = await t.writeBackup(name, '{"probe":true}').then(
        () => true,
        () => false,
      );
      const listed = (await t.listBackups()).includes(name);
      // THE invariant, and the one that protects the user: a successful write
      // is always listable, and a rejected name is never written at all.
      expect(listed).toBe(accepted);
      // Reserved names are rejected for exactly the reason they would be
      // hidden — the reservation rule and the visibility rule are one rule.
      expect(accepted).toBe(!isInternalBackupArtifact(name));
    }
    // Every name that was accepted is visible; none of the reserved ones is.
    expect((await t.listBackups()).sort()).toEqual(
      ['UPPER.JSON', 'a.tmp.json', 'dots.in.the.middle.json', 'normal.json', 'with space.json'].sort(),
    );
  });

  it('writes no file at all for a rejected name', async () => {
    // A rejected name must not leave a partial or hidden artifact behind: the
    // whole point of rejecting is that the user ends up with nothing rather
    // than something they cannot see.
    const t = createFileBackupTransport();
    for (const bad of ['', '.', '..', '.hidden.json', 'run.tmp', 'a/b', 'a\\b', 'a\u0000b']) {
      await expect(t.writeBackup(bad, '{}')).rejects.toThrow();
    }
    expect(await t.listBackups()).toEqual([]);
  });

  /**
   * Plant a raw file in the mocked backup directory. The mock store is keyed by
   * URI, and the directory entry is the first key written by
   * `ensureBackupDirectory`, so its parent gives the document root.
   */
  function plantHiddenFile(fileName: string, content: string): void {
    const dirKey = [...mockStore.keys()].find((k) => k.endsWith('/backups'));
    if (!dirKey) throw new Error('backup directory was never created');
    mockStore.set(`${dirKey}/${fileName}`, { kind: 'file', content });
  }

  it('070: reports a stranded rotation copy and lets the user delete it', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('unrelated.json', '{}');

    // An interrupted replacement: the old content survives ONLY at the rotation
    // sibling, because the process died between the rotation and the rename and
    // the live name is therefore absent. This is the one case the sweep must
    // NOT reclaim — deleting it would destroy the last copy of a backup.
    const rotationName = '.interrupted.json.prev';
    plantHiddenFile(rotationName, 'PREVIOUS-ONLY-COPY');

    const stranded = await t.listStrandedArtifacts?.();
    expect(stranded).toEqual([rotationName]);
    // Reported, never hidden, and the content is still there.
    expect(await t.readBackup('unrelated.json')).toBe('{}');
    expect([...mockStore.values()].some((e) => e.content === 'PREVIOUS-ONLY-COPY')).toBe(true);

    await t.deleteStrandedArtifact?.(rotationName);
    expect(await t.listStrandedArtifacts?.()).toEqual([]);
  });

  it('070: reports a file an earlier build saved under a now-hidden name', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('unrelated.json', '{}');
    // A dotfile under the current rule, written by a build that accepted it.
    // The app once reported it as saved and can now neither show nor restore
    // it, so it must be surfaced rather than quietly swept.
    const legacy = '.legacy-backup.json';
    plantHiddenFile(legacy, '{}');

    expect(await t.listStrandedArtifacts?.()).toContain(legacy);
    expect(await t.listBackups()).not.toContain(legacy);
  });

  it('070: deletion of a stranded artifact goes through its own seam', async () => {
    // `deleteBackup` validates against the listing rule — the very rule that
    // hid the file — so routing deletion through it would make the artifact
    // permanently undeletable. Hence a separate method.
    const t = createFileBackupTransport();
    await expect(t.deleteBackup('.hidden.json')).rejects.toThrow(
      /reserved for internal backup files/,
    );
    await expect(t.deleteStrandedArtifact?.('.hidden.json')).resolves.toBeUndefined();
  });

  it('070: stranded-artifact deletion refuses a visible backup name', async () => {
    // The seam is for hidden files only; a visible name must go through the
    // normal (two-tap, confirm-guarded) delete control.
    const t = createFileBackupTransport();
    await t.writeBackup('visible.json', '{}');
    await expect(t.deleteStrandedArtifact?.('visible.json')).rejects.toThrow(
      /not a hidden backup artifact/,
    );
    expect(await t.listBackups()).toContain('visible.json');
  });

  it('070: a pure-litter leftover is reclaimed, not reported', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('live.json', 'NEW');
    // A `.prev` whose live counterpart EXISTS is stale litter, not a stranded
    // copy of anything — the sweep reclaims it instead of asking the user.
    plantHiddenFile('.live.json.prev', 'OLD');

    expect(await t.listStrandedArtifacts?.()).toEqual([]);
    // ...and it is actually gone, not merely unreported.
    expect([...mockStore.values()].filter((e) => e.content === 'OLD')).toHaveLength(0);
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

  it('hides dotfiles and leftover .tmp partials from the listing', async () => {
    const t = createFileBackupTransport();
    await t.writeBackup('real.json', 'complete');
    // An aborted atomic write can leave the writer's `.<name>.<nonce>.tmp`
    // partial behind, and platform metadata files are dotfiles; neither is a
    // restorable backup and neither may be selectable in the UI.
    mockStore.set('file:///mock-documents/backups/.real.json.abc123.tmp', {
      kind: 'file',
      content: 'partial',
    });
    mockStore.set('file:///mock-documents/backups/.hidden.json', {
      kind: 'file',
      content: '{}',
    });
    expect(await t.listBackups()).toEqual(['real.json']);
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

  it('062: rejects a size-absent hostile file via its stat size, unread', async () => {
    // Providers that omit `asset.size` used to bypass the gate entirely.
    // The content is large; only the picker report is silent.
    mockStore.set('file:///cache/nosize-huge.json', {
      kind: 'file',
      content: 'x'.repeat(MAX_BACKUP_TEXT_LENGTH + 1),
    });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/nosize-huge.json', name: 'nosize-huge.json' }],
    });

    await expect(pickBackupFile()).rejects.toThrow(/too large/i);
    expect(mockTextReads).toBe(0);
  });

  it('062: reads a size-absent file that fits within the cap', async () => {
    mockStore.set('file:///cache/nosize-ok.json', { kind: 'file', content: '{"format":"x"}' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/nosize-ok.json', name: 'nosize-ok.json' }],
    });

    await expect(pickBackupFile()).resolves.toEqual({
      name: 'nosize-ok.json',
      text: '{"format":"x"}',
    });
    expect(mockTextReads).toBe(1);
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
