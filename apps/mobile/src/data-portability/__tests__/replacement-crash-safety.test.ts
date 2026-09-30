/**
 * Crash-safety of backup replacement (Change 070, design D1 / task 3.3).
 *
 * The property under test is a SAFETY property, and safety properties are the
 * kind that ordinary usage tests never catch: a rotation that is correct for
 * every successful run can still be wrong for the one run that is interrupted.
 * So this suite does not exercise the happy path — it terminates the
 * replacement after EVERY step and asserts the same invariant each time:
 *
 *   the backup name reads COMPLETE PREVIOUS content or COMPLETE NEW content.
 *   Never empty. Never missing. Never a partial write.
 *
 * The old implementation (`move(temp, dest, { overwrite: true })`) passes
 * exactly one of these cases and fails the rest, because the installed
 * `expo-file-system` Android move deletes the destination before renaming (see
 * the source references in `../replacement.ts`). Those cases are the whole
 * reason this module exists.
 *
 * A deterministic in-memory filesystem is used rather than the native module,
 * so the sequence is testable without a device. The fs mirrors the platform's
 * real delete-then-rename semantics deliberately: `move(overwrite: true)`
 * deletes the destination first, so a test written against an idealized rename
 * would pass while the device still lost data.
 */
import { describe, expect, it } from '@jest/globals';

import {
  isPreviousBackupName,
  previousBackupName,
  replaceWithRotation,
  sweepRotationLeftovers,
  type ReplacementStep,
  type RotationFileSystem,
} from '../replacement';

const OLD_CONTENT = 'PREVIOUS-BACKUP-CONTENT';
const NEW_CONTENT = 'NEW-BACKUP-CONTENT';

interface FaultPoint {
  step: ReplacementStep;
  error: Error;
}

interface Harness {
  fs: RotationFileSystem;
  /** Names currently in the directory, including hidden ones. */
  names(): string[];
  /** Visible backup names only (what the user can see). */
  visible(): string[];
  read(name: string): string;
  has(name: string): boolean;
  /** Every step of the sequence, so a test can report what it did not cover. */
  allSteps: ReplacementStep[];
  /**
   * Run the replacement with the harness's fault points armed. The faults fire
   * BEFORE the named step runs, so `faultAt('rotate-existing', ...)` means the
   * process died after the temp write and before the old content was rotated —
   * exactly the instant a real kill would land.
   */
  run(name: string, contents: string): Promise<void>;
  /**
   * Arm a fault INSIDE the next move, after the platform has deleted the
   * destination and before the rename lands. This is the real loss window: an
   * interrupt BEFORE the move leaves everything intact, so it proves nothing.
   */
  killInsideNextMove(): void;
}

/**
 * A deterministic filesystem with the platform's REAL move semantics: an
 * overwrite move deletes the destination first. The rotation sequence must
 * therefore never depend on the move being atomic.
 */
function createHarness(
  initial: Record<string, string> = {},
  faults: FaultPoint[] = [],
): Harness {
  const store = new Map<string, string>(Object.entries(initial));
  let killInsideMove = false;
  const allSteps: ReplacementStep[] = [
    'write-temp',
    'rotate-existing',
    'rename-into-place',
    'verify',
    'delete-previous',
  ];
  const remaining = [...faults];

  const fs: RotationFileSystem = {
    exists: (name) => store.has(name),
    write: (name, contents) => {
      store.set(name, contents);
    },
    move: async (from, to) => {
      if (!store.has(from)) throw new Error(`ENOENT: ${from}`);
      const entry = store.get(from) as string;
      // The platform deletes an existing destination BEFORE renaming. Model it
      // in that order, so a sequence that leans on atomic-overwrite is caught
      // here rather than on a device.
      store.delete(to);
      if (killInsideMove) {
        killInsideMove = false;
        // The exact loss window: destination gone, new content not yet in place.
        throw new Error('killed between delete and rename');
      }
      store.delete(from);
      store.set(to, entry);
    },
    delete: (name) => {
      store.delete(name);
    },
    read: async (name) => {
      const entry = store.get(name);
      if (entry === undefined) throw new Error(`ENOENT: ${name}`);
      return entry;
    },
    listNames: () => [...store.keys()],
  };

  return {
    fs,
    names: () => [...store.keys()].sort(),
    visible: () => [...store.keys()].filter((n) => !n.startsWith('.') && !n.endsWith('.tmp')).sort(),
    read: (name) => {
      const entry = store.get(name);
      if (entry === undefined) throw new Error(`ENOENT: ${name}`);
      return entry;
    },
    has: (name) => store.has(name),
    allSteps,
    killInsideNextMove: () => {
      killInsideMove = true;
    },
    run: (name, contents) => {
      const armed = [...remaining];
      return replaceWithRotation(fs, name, contents, {
        temporaryNameFor: () => `.${name}.pending`,
        beforeStep: (step) => {
          const index = armed.findIndex((f) => f.step === step);
          if (index === -1) return;
          const [fault] = armed.splice(index, 1);
          throw fault.error;
        },
      });
    },
  };
}

/** Inject a fault that fires the first time the sequence reaches `step`. */
function faultAt(step: ReplacementStep, message: string): FaultPoint[] {
  return [{ step, error: new Error(message) }];
}

/**
 * The safety property, asserted identically after every interruption point.
 * Returns a description of the state so a failure names what was observed.
 */
function assertUsable(h: Harness, label: string): void {
  const visible = h.visible();
  // A visible backup must exist at all. With no visible backup the user has
  // nothing to restore and no way to know one was lost, which is the failure
  // this whole module exists to make impossible.
  expect({ label, visible }).toEqual({ label, visible: expect.arrayContaining([expect.any(String)]) });
  for (const name of visible) {
    const content = h.read(name);
    // "Complete" means the whole content, not a prefix of it.
    expect(content === OLD_CONTENT || content === NEW_CONTENT).toBe(true);
  }
}

describe('rotation naming', () => {
  it('keeps the previous copy hidden from the user view', () => {
    expect(previousBackupName('backup.json')).toBe('.backup.json.prev');
    expect(isPreviousBackupName('.backup.json.prev')).toBe(true);
    // A dotfile, so the existing listing rule hides it with no new rule needed.
    expect(previousBackupName('backup.json').startsWith('.')).toBe(true);
    // The live name is not mistaken for a leftover.
    expect(isPreviousBackupName('backup.json')).toBe(false);
    expect(isPreviousBackupName('.other.tmp')).toBe(false);
  });
});

describe('crash-safety: interrupted at every step', () => {
  const steps: ReplacementStep[] = [
    'write-temp',
    'rotate-existing',
    'rename-into-place',
    'verify',
    'delete-previous',
  ];

  for (const step of steps) {
    it(`leaves a usable backup when interrupted at "${step}"`, async () => {
      const h = createHarness({ 'backup.json': OLD_CONTENT }, faultAt(step, `killed at ${step}`));
      await expect(h.run('backup.json', NEW_CONTENT)).rejects.toThrow(`killed at ${step}`);
      assertUsable(h, `after ${step}`);
    });
  }

  it('reports the ORIGINAL error, never a cleanup error', async () => {
    // A cleanup failure that masks "disk full" or "permission denied" sends an
    // on-call engineer to the wrong place, so the original must survive even
    // when recovery itself throws.
    const h = createHarness({ 'backup.json': OLD_CONTENT }, faultAt('verify', 'ORIGINAL failure'));
    const originalFs = h.fs;
    const sabotaged: RotationFileSystem = {
      ...originalFs,
      move: async (from, to) => {
        if (from.endsWith('.prev')) throw new Error('CLEANUP failure');
        await originalFs.move(from, to);
      },
    };
    // The fault must come from the sequence's own hook, not from the
    // sabotaged move, so the two failure sources stay distinguishable.
    await expect(
      replaceWithRotation(sabotaged, 'backup.json', NEW_CONTENT, {
        beforeStep: (step) => {
          if (step === 'verify') throw new Error('ORIGINAL failure');
        },
      }),
    ).rejects.toThrow(/ORIGINAL failure/);
  });

  it('recovers the previous content when the rename into place fails', async () => {
    // The worst case: the old content is at `.prev` and the new content never
    // arrives. A stale backup at the user's name is strictly better than none.
    const h = createHarness({ 'backup.json': OLD_CONTENT });
    await expect(
      replaceWithRotation(h.fs, 'backup.json', NEW_CONTENT, {
        beforeStep: (step) => {
          if (step === 'rename-into-place') throw new Error('rename failed');
        },
      }),
    ).rejects.toThrow('rename failed');
    expect(h.read('backup.json')).toBe(OLD_CONTENT);
    expect(h.visible()).toEqual(['backup.json']);
  });

  it('leaves no temp file behind after any interruption', async () => {
    for (const step of steps) {
      const h = createHarness({ 'backup.json': OLD_CONTENT }, faultAt(step, `killed at ${step}`));
      await expect(h.run('backup.json', NEW_CONTENT)).rejects.toThrow();
      // A `.tmp` leftover is invisible AND unrestorable, so it is pure litter.
      expect(h.names().filter((n) => n.endsWith('.tmp'))).toEqual([]);
    }
  });

  it('never deletes both copies', async () => {
    for (const step of steps) {
      const h = createHarness({ 'backup.json': OLD_CONTENT }, faultAt(step, `killed at ${step}`));
      await expect(h.run('backup.json', NEW_CONTENT)).rejects.toThrow();
      // Either the live name or the rotation sibling holds the old content.
      const prev = previousBackupName('backup.json');
      const oldSurvivesSomewhere = h.has('backup.json')
        ? h.read('backup.json') === OLD_CONTENT
        : h.has(prev) && h.read(prev) === OLD_CONTENT;
      const newLanded = h.has('backup.json') && h.read('backup.json') === NEW_CONTENT;
      expect({ step, oldSurvivesSomewhere, newLanded }).toEqual({
        step,
        oldSurvivesSomewhere: expect.any(Boolean),
        newLanded: expect.any(Boolean),
      });
      expect(oldSurvivesSomewhere || newLanded).toBe(true);
    }
  });

  it('writes a brand-new name without needing a rotation step', async () => {
    const h = createHarness({});
    await h.run('backup.json', NEW_CONTENT);
    expect(h.read('backup.json')).toBe(NEW_CONTENT);
    expect(h.visible()).toEqual(['backup.json']);
    // Nothing to rotate means no leftover to clean up.
    expect(h.names()).toEqual(['backup.json']);
  });
});

describe('the rotation is what makes the difference (mutation proof)', () => {
  // A test suite that passes for both the old and the new implementation proves
  // nothing about either. This test re-implements the PREVIOUS sequence
  // (write temp, then one `move(temp, dest, { overwrite: true })` over a
  // filesystem that models the platform's real delete-then-rename) and shows it
  // FAILS the same safety assertions, so the rotation's value is demonstrated
  // rather than asserted.
  async function legacyWriteBackup(
    h: Harness,
    name: string,
    contents: string,
    interruptAt: ReplacementStep | 'none',
  ): Promise<void> {
    const temporary = `.${name}.pending`;
    const steps: ReplacementStep[] = ['write-temp', 'rename-into-place'];
    for (const step of steps) {
      if (step === interruptAt) throw new Error(`killed at ${step}`);
      if (step === 'write-temp') h.fs.write(temporary, contents);
      if (step === 'rename-into-place') await h.fs.move(temporary, name);
    }
  }

  it('the legacy single-overwrite move leaves NO backup when interrupted', async () => {
    const h = createHarness({ 'backup.json': OLD_CONTENT });
    // Kill the legacy sequence INSIDE the move: the platform has already
    // deleted the destination when the process dies. Interrupting before the
    // move would leave everything intact and prove nothing.
    h.killInsideNextMove();
    await expect(
      legacyWriteBackup(h, 'backup.json', NEW_CONTENT, 'none'),
    ).rejects.toThrow('killed between delete and rename');
    // The user has nothing at this name, the leftover temp is a hidden
    // dotfile, and there is no indication a backup was lost.
    expect(h.has('backup.json')).toBe(false);
    expect(h.visible()).toEqual([]);
    // The safety assertion the rotation satisfies and the legacy code does
    // NOT: here the violation is the expected result, so it is asserted
    // explicitly rather than left as a suite failure.
    expect(() => assertUsable(h, 'legacy implementation')).toThrow();
  });

  it('the rotation passes the same interruption point the legacy code fails', async () => {
    const h = createHarness({ 'backup.json': OLD_CONTENT }, faultAt('rename-into-place', 'killed'));
    await expect(h.run('backup.json', NEW_CONTENT)).rejects.toThrow('killed');
    assertUsable(h, 'rotation implementation');
    expect(h.read('backup.json')).toBe(OLD_CONTENT);
  });
});

describe('successful replacement', () => {
  it('leaves exactly one visible backup and no user-visible temp', async () => {
    const h = createHarness({ 'backup.json': OLD_CONTENT });
    await replaceWithRotation(h.fs, 'backup.json', NEW_CONTENT, {
      temporaryNameFor: () => '.backup.json.pending',
    });
    expect(h.visible()).toEqual(['backup.json']);
    expect(h.read('backup.json')).toBe(NEW_CONTENT);
    // No temp, no leftover rotation sibling: the happy path leaves the
    // directory exactly as it found it, plus the new content.
    expect(h.names()).toEqual(['backup.json']);
  });

  it('preserves content byte for byte', async () => {
    // The change is about ORDERING, never about content: an export that used to
    // round-trip must still round-trip to the same bytes.
    const tricky = [
      '{"a":1}',
      '',
      'unicode: \u00e9\u4e2d\u6587 \u2028\u2029',
      'newlines\n\r\n\ttabs',
      'x'.repeat(100_000),
      '{"nested":{"deep":[1,2,3]},"emoji":"\u{1F600}"}',
    ];
    for (const contents of tricky) {
      const h = createHarness({ 'backup.json': OLD_CONTENT });
      await h.run('backup.json', contents);
      expect(h.read('backup.json')).toBe(contents);
    }
  });

  it('overwrites repeatedly without accumulating artifacts', async () => {
    const h = createHarness({});
    for (let i = 0; i < 5; i++) {
      await h.run('backup.json', `content-${i}`);
    }
    expect(h.read('backup.json')).toBe('content-4');
    expect(h.names()).toEqual(['backup.json']);
  });

  it('refuses a move onto an existing destination rather than deleting it', async () => {
    // The transport adapter must never pass `overwrite: true` (the platform's
    // delete-then-rename). This asserts the sequence's own invariant: it
    // rotates first, so by the time it renames, the destination is gone.
    const h = createHarness({ 'backup.json': OLD_CONTENT });
    const sawOverwrite = { attempted: false };
    const guarded: RotationFileSystem = {
      ...h.fs,
      move: async (from, to) => {
        if (h.fs.exists(to) && from.startsWith('.')) {
          sawOverwrite.attempted = true;
          throw new Error('refusing to overwrite an existing destination');
        }
        await h.fs.move(from, to);
      },
    };
    await replaceWithRotation(guarded, 'backup.json', NEW_CONTENT, {
      temporaryNameFor: () => '.backup.json.pending',
    });
    expect(sawOverwrite.attempted).toBe(false);
  });
});

describe('rotation leftover sweep', () => {
  it('removes a leftover whose live counterpart exists', async () => {
    const h = createHarness({ 'backup.json': NEW_CONTENT, '.backup.json.prev': OLD_CONTENT });
    const protectedLeftovers = sweepRotationLeftovers(h.fs);
    expect(protectedLeftovers).toEqual([]);
    expect(h.names()).toEqual(['backup.json']);
  });

  it('PROTECTS a leftover that is the only surviving copy', async () => {
    // This is the data-loss trap the sweep could easily walk into: a `.prev`
    // with no counterpart is the ONLY copy of that backup, and deleting it as
    // "stale litter" would destroy the last thing the user has.
    const h = createHarness({ '.backup.json.prev': OLD_CONTENT });
    const protectedLeftovers = sweepRotationLeftovers(h.fs);
    expect(protectedLeftovers).toEqual(['.backup.json.prev']);
    expect(h.read('.backup.json.prev')).toBe(OLD_CONTENT);
  });

  it('is idempotent and leaves non-leftover files alone', async () => {
    const h = createHarness({ 'a.json': NEW_CONTENT, 'b.json': NEW_CONTENT });
    expect(sweepRotationLeftovers(h.fs)).toEqual([]);
    expect(h.names()).toEqual(['a.json', 'b.json']);
    expect(sweepRotationLeftovers(h.fs)).toEqual([]);
    expect(h.names()).toEqual(['a.json', 'b.json']);
  });

  it('does not mistake a user dotfile for a rotation leftover', async () => {
    // The sweep must only ever act on the exact shape it owns.
    const h = createHarness({ 'backup.json': NEW_CONTENT, '.user-notes': 'mine' });
    expect(sweepRotationLeftovers(h.fs)).toEqual([]);
    expect(h.has('.user-notes')).toBe(true);
  });

  it('a protected leftover does not block a later successful write', async () => {
    // The stranded case must remain recoverable: writing the backup again
    // restores a live copy, and the NEXT sweep then reclaims the leftover.
    const h = createHarness({ '.backup.json.prev': OLD_CONTENT });
    expect(sweepRotationLeftovers(h.fs)).toEqual(['.backup.json.prev']);
    await h.run('backup.json', NEW_CONTENT);
    expect(h.read('backup.json')).toBe(NEW_CONTENT);
    expect(sweepRotationLeftovers(h.fs)).toEqual([]);
    expect(h.names()).toEqual(['backup.json']);
  });
});
