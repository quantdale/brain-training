/**
 * Data-management UX contract tests (campaign 012 W12).
 *
 * Pins the release-quality behaviors of the backup/restore/wipe surface:
 * device-local honesty copy, share-sheet capability messaging, two-tap
 * destructive confirmations (replace import + saved-backup delete), the
 * backup-first offer inside the wipe flow, and preview-gated imports.
 *
 * The portability engine and the native file transport are fully mocked:
 * these tests exercise the SCREEN layer only. Mock factories are deliberately
 * self-contained (no out-of-scope closures): hoisted jest.mock factories run
 * during static-import evaluation, before test-file bindings exist.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

import type { ImportPreview } from '@/data-portability';
import DataManagementScreen from '@/app/data-management';
import { refreshProgression } from '@/progression';

import {
  applyImport,
  defaultBackupName,
  exportLocalDataBundle,
  previewImport,
  wipeLocalData,
} from '@/data-portability';
import {
  pickBackupFile,
  shareBackupFile,
} from '@/data-portability/file-transport';

jest.mock('@/db', () => ({
  getDb: jest.fn(() => ({ __testDb: true })),
}));

jest.mock('@/data-portability/file-transport', () => {
  // In-memory stand-in for the real file transport. Every
  // `createFileBackupTransport()` call hands back this one singleton, so the
  // screen and the assertions below observe the same store.
  const store = new Map<string, string>();
  const transport = {
    writeBackup: jest.fn(async (name: string, contents: string) => {
      store.set(name, contents);
    }),
    readBackup: jest.fn(async (name: string) => {
      const text = store.get(name);
      if (text === undefined) {
        throw new Error(`No backup named "${name}" found in app backups`);
      }
      return text;
    }),
    listBackups: jest.fn(async () =>
      [...store.keys()].sort((a, b) => b.localeCompare(a)),
    ),
    deleteBackup: jest.fn(async (name: string) => {
      store.delete(name);
    }),
    __resetStore: () => store.clear(),
  };
  return {
    createFileBackupTransport: jest.fn(() => transport),
    pickBackupFile: jest.fn(async () => null),
    shareBackupFile: jest.fn(async () => false),
    __transport: transport,
  };
});

jest.mock('@/data-portability', () => ({
  countLocalData: jest.fn(async () => ({
    gameSessions: 7,
    domainRatings: 0,
    ratingHistory: 0,
    currencyLedger: 3,
    gameFavorites: 0,
    xpAwards: 0,
    tutorialState: 0,
    workoutInstances: 0,
    questDefinitions: 0,
    questProgress: 0,
    achievementDefinitions: 0,
    achievementUnlocks: 0,
    hasProfile: true,
    storageBytes: 0,
  })),
  defaultBackupName: jest.fn(() => 'backup-test.json'),
  exportLocalDataBundle: jest.fn(async () => ({
    envelope: { data: { gameSessions: [1, 2], currencyLedger: [1] } },
    text: '{"format":"brain-training-backup"}',
  })),
  parseAndValidateBackup: jest.fn(() => ({ parsed: true })),
  previewImport: jest.fn(),
  applyImport: jest.fn(async () => ({
    sessionsAdded: 2,
    sessionsSkipped: 0,
    ledgerAdded: 1,
  })),
  wipeLocalData: jest.fn(async () => undefined),
}));

// The screen re-seeds the profile + quest/achievement catalogs after a wipe or
// replace import via `refreshProgression`; the engine behavior itself is pinned
// by the progression suite, so this file only pins the call-site wiring.
jest.mock('@/progression', () => ({
  refreshProgression: jest.fn(async () => undefined),
}));

interface MockTransport {
  writeBackup: jest.Mock;
  readBackup: jest.Mock;
  listBackups: jest.Mock;
  deleteBackup: jest.Mock;
  __resetStore: () => void;
}

const mockedFileTransport = jest.requireMock(
  '@/data-portability/file-transport',
) as {
  createFileBackupTransport: () => MockTransport;
};

/** Same singleton the screen holds (factory returns one shared object). */
const transport: MockTransport =
  mockedFileTransport.createFileBackupTransport();

const mockedPreviewImport = jest.mocked(previewImport);
const mockedApplyImport = jest.mocked(applyImport);
const mockedRefreshProgression = jest.mocked(refreshProgression);
const mockedExportLocalDataBundle = jest.mocked(exportLocalDataBundle);
const mockedDefaultBackupName = jest.mocked(defaultBackupName);
const mockedPickBackupFile = jest.mocked(pickBackupFile);
const mockedShareBackupFile = jest.mocked(shareBackupFile);

function validPreview(mode: 'merge' | 'replace'): ImportPreview {
  return {
    valid: true,
    mode,
    meta: {
      format: 'brain-training-backup',
      version: 1,
      createdAt: 0,
      schemaVersion: 1,
      counts: {
        gameSessions: 3,
        domainRatings: 0,
        ratingHistory: 0,
        currencyLedger: 4,
        gameFavorites: 0,
        xpAwards: 0,
        tutorialState: 0,
        workoutInstances: 0,
        questDefinitions: 0,
        questProgress: 0,
        achievementDefinitions: 0,
        achievementUnlocks: 0,
        hasProfile: true,
      },
    },
    counters: {
      mode,
      sessionsAdded: 3,
      sessionsSkipped: 1,
      ratingHistoryAdded: 0,
      ledgerAdded: 4,
      xpAwardsAdded: 0,
      favoritesAdded: 0,
      domainRatingsUpdated: 0,
      tutorialsUpdated: 0,
      workoutsUpdated: 0,
      questDefinitionsUpdated: 0,
      questProgressUpdated: 0,
      achievementDefinitionsUpdated: 0,
      achievementUnlocksUpdated: 0,
      profileMerged: false,
      warnings: [],
    },
    notes: [],
    parsed: { marker: 'parsed-backup' } as unknown as ImportPreview['parsed'],
  };
}

async function renderScreen() {
  // renderRouter enables fake timers internally, and its awaited promise can
  // resolve before expo-router finishes mounting the initial route on a slow
  // machine — while RNTL's findBy* under fake timers burns its whole wait
  // budget almost instantly. Switching to real timers after render makes all
  // subsequent queries poll genuine wall-clock time.
  await renderRouter(
    { 'data-management': () => <DataManagementScreen /> },
    { initialUrl: '/data-management' },
  );
  jest.useRealTimers();
  await screen.findByTestId('data-management-title', { timeout: 10_000 });
}

async function typeImportJson(text = '{"backup":true}') {
  const input = await screen.findByTestId('data-import-input');
  fireEvent.changeText(input, text);
  // Concurrent React flushes the controlled-value update asynchronously;
  // wait until it has round-tripped through state before acting further.
  await waitFor(() => {
    expect(screen.getByTestId('data-import-input').props.value).toBe(text);
  });
}

describe('data-management UX contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transport.__resetStore();
    mockedPickBackupFile.mockResolvedValue(null);
    mockedShareBackupFile.mockResolvedValue(false);
  });

  it('renders local counts with device-local honesty copy', async () => {
    await renderScreen();

    // Counts bind to the mocked engine snapshot.
    expect(await screen.findByTestId('data-count-sessions')).toBeOnTheScreen();
    expect(await screen.findByText('7')).toBeOnTheScreen();
    // A backend without PRAGMA byte metrics is still populated: the profile
    // and exact local counts make the store ready, not empty.
    expect(screen.getByTestId('data-storage-summary-value')).toHaveTextContent(
      'Ready',
    );
    // No invented cloud/account features: the phone is the only home for data.
    expect(screen.getByText(/lives only on this phone/i)).toBeOnTheScreen();
  });

  it('lists saved backups from earlier sessions on mount', async () => {
    await transport.writeBackup('old.json', '{"older":true}');
    await renderScreen();

    expect(
      await screen.findByTestId('data-backup-load-old.json'),
    ).toBeOnTheScreen();
  });

  it('export saves to the transport, lists it, and offers Share', async () => {
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-export-button'));

    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(
      /Saved on this phone as backup-test\.json/,
    );
    expect(transport.writeBackup).toHaveBeenCalledWith(
      'backup-test.json',
      '{"format":"brain-training-backup"}',
    );
    // One single-pass bundle call produced BOTH the text and the counts —
    // no separate export-then-serialize walk.
    expect(mockedExportLocalDataBundle).toHaveBeenCalledTimes(1);
    // The generated name receives the live backup inventory so a same-second
    // re-export can skip names that are already taken.
    expect(mockedDefaultBackupName).toHaveBeenCalledWith(expect.any(Date), []);
    expect(
      await screen.findByTestId('data-backup-load-backup-test.json'),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('data-export-share-backup-test.json'),
    ).toBeOnTheScreen();
  });

  it('explains when the share sheet is unavailable instead of failing silently', async () => {
    mockedShareBackupFile.mockResolvedValue(false);
    await transport.writeBackup('b1.json', '{}');
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-backup-share-b1.json'));

    const message = await screen.findByTestId('data-message');
    await waitFor(() =>
      expect(message).toHaveTextContent(/Sharing isn't available/i),
    );
  });

  it('hands a saved backup to the system share sheet when available', async () => {
    mockedShareBackupFile.mockResolvedValue(true);
    await transport.writeBackup('b1.json', '{}');
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-backup-share-b1.json'));

    const message = await screen.findByTestId('data-message');
    await waitFor(() =>
      expect(message).toHaveTextContent(/system share sheet/),
    );
    expect(mockedShareBackupFile).toHaveBeenCalledWith('b1.json');
  });

  it('requires a confirming second tap before Replace import runs', async () => {
    mockedPreviewImport.mockResolvedValue(validPreview('replace'));
    await renderScreen();
    await typeImportJson();

    const replaceButton = screen.getByTestId('data-import-replace');
    fireEvent.press(replaceButton);

    // Armed only: no write may have happened yet.
    await screen.findByText(/Tap again to erase and restore/);
    expect(mockedApplyImport).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('data-import-replace'));

    await waitFor(() =>
      expect(mockedApplyImport).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'replace',
      ),
    );
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(/Replace complete/);
    // Replace erases the seeded catalog: the call site must restore it.
    expect(mockedRefreshProgression).toHaveBeenCalled();
  });

  it('disarms Replace when the input is cleared', async () => {
    mockedPreviewImport.mockResolvedValue(validPreview('replace'));
    await renderScreen();
    await typeImportJson();

    fireEvent.press(screen.getByTestId('data-import-replace'));
    await screen.findByText(/Tap again to erase and restore/);

    fireEvent.changeText(await screen.findByTestId('data-import-input'), '');
    await waitFor(() => {
      expect(screen.getByTestId('data-import-input').props.value).toBe('');
    });
    // Empty input disables the control; the arm must not survive re-enable.
    expect(
      screen.getByTestId('data-import-replace').props.accessibilityState
        ?.disabled,
    ).toBe(true);
    expect(screen.queryByText(/Tap again to erase and restore/)).toBeNull();
  });

  it('applies Merge import on a single tap', async () => {
    mockedPreviewImport.mockResolvedValue(validPreview('merge'));
    await renderScreen();
    await typeImportJson();

    fireEvent.press(await screen.findByTestId('data-import-merge'));

    await waitFor(() =>
      expect(mockedApplyImport).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'merge',
      ),
    );
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(/Merge complete/);
    // Merge keeps existing definitions; only replace/wipe re-seed.
    expect(mockedRefreshProgression).not.toHaveBeenCalled();
  });

  it('rejects an invalid backup without writing anything', async () => {
    mockedPreviewImport.mockResolvedValue({
      valid: false,
      mode: 'merge',
      meta: {} as ImportPreview['meta'],
      error: { kind: 'checksum', message: 'checksum mismatch' },
      counters: validPreview('merge').counters,
      notes: [],
    });
    await renderScreen();
    await typeImportJson('{bad json');

    fireEvent.press(await screen.findByTestId('data-preview-merge'));

    const message = await screen.findByTestId('data-message');
    await waitFor(() => expect(message).toHaveTextContent(/checksum mismatch/));
    expect(mockedApplyImport).not.toHaveBeenCalled();
  });

  it('requires two taps to delete a saved backup', async () => {
    await transport.writeBackup('old.json', '{}');
    await renderScreen();

    // First tap only arms the destructive control.
    fireEvent.press(await screen.findByTestId('data-backup-delete-old.json'));
    expect(await screen.findByText(/Tap to confirm/)).toBeOnTheScreen();
    expect(transport.deleteBackup).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('data-backup-delete-old.json'));
    await waitFor(() =>
      expect(transport.deleteBackup).toHaveBeenCalledWith('old.json'),
    );
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(/Deleted saved backup "old\.json"/);
  });

  it('gates the wipe behind typed DELETE confirmation', async () => {
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-wipe-button'));
    expect(jest.mocked(wipeLocalData)).not.toHaveBeenCalled();

    fireEvent.changeText(
      await screen.findByTestId('data-wipe-confirm'),
      'DELETE',
    );
    await waitFor(() => {
      expect(screen.getByTestId('data-wipe-confirm').props.value).toBe(
        'DELETE',
      );
    });
    fireEvent.press(screen.getByTestId('data-wipe-button'));

    await waitFor(() => expect(jest.mocked(wipeLocalData)).toHaveBeenCalled());
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(/Saved backup files were kept/);
    // The wipe clears the profile + catalogs: the call site must restore them
    // in-process (pinned at the engine level by the progression suite).
    await waitFor(() => expect(mockedRefreshProgression).toHaveBeenCalled());
  });

  it('surfaces a mid-wipe engine failure and never claims the wipe succeeded', async () => {
    // The engine throws AFTER the confirmation gate passes: the failure must
    // surface verbatim, the success copy must not render, and the armed
    // confirmation must survive so the operator can retry.
    jest
      .mocked(wipeLocalData)
      .mockRejectedValueOnce(new Error('disk I/O error while clearing'));
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-wipe-button'));
    fireEvent.changeText(
      await screen.findByTestId('data-wipe-confirm'),
      'DELETE',
    );
    await waitFor(() => {
      expect(screen.getByTestId('data-wipe-confirm').props.value).toBe(
        'DELETE',
      );
    });
    fireEvent.press(screen.getByTestId('data-wipe-button'));

    await waitFor(() =>
      expect(jest.mocked(wipeLocalData)).toHaveBeenCalledTimes(1),
    );
    const message = await screen.findByTestId('data-message');
    await waitFor(() =>
      expect(message).toHaveTextContent(
        /Wipe failed: disk I\/O error while clearing/,
      ),
    );
    expect(message).not.toHaveTextContent(/All local training data wiped/);
    // Failure path leaves the confirmation and the retry affordance intact:
    // no success-only state reset (confirm cleared / busy stuck) ran.
    expect(screen.getByTestId('data-wipe-confirm').props.value).toBe(
      'DELETE',
    );
    expect(
      screen.getByTestId('data-wipe-button').props.accessibilityState
        ?.disabled ?? false,
    ).toBe(false);
    // No automatic retry loop: still exactly one attempted wipe.
    expect(jest.mocked(wipeLocalData)).toHaveBeenCalledTimes(1);
  });

  it('offers a backup-first export inside the wipe card', async () => {
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-wipe-export-first'));

    await waitFor(() =>
      expect(mockedExportLocalDataBundle).toHaveBeenCalled(),
    );
    const message = await screen.findByTestId('data-message');
    expect(message).toHaveTextContent(/backup-test\.json/);
  });

  it('surfaces picker cancellation without an error message', async () => {
    await renderScreen();

    fireEvent.press(await screen.findByTestId('data-import-from-file'));
    await waitFor(() => expect(mockedPickBackupFile).toHaveBeenCalled());
    // Canceled pickers are not errors — no message card should appear.
    expect(screen.queryByTestId('data-message')).toBeNull();
  });

  it('never starts a second preview while the first is still in flight', async () => {
    // Hold the first preview open; the screen must stay busy for its duration.
    let release: (value: ImportPreview) => void = () => {};
    const pending = new Promise<ImportPreview>((resolve) => {
      release = resolve;
    });
    mockedPreviewImport.mockReturnValue(pending);
    await renderScreen();
    await typeImportJson();

    fireEvent.press(await screen.findByTestId('data-preview-merge'));
    await waitFor(() => expect(mockedPreviewImport).toHaveBeenCalledTimes(1));

    // Fast repeat taps (different preview modes) while the first is pending:
    // neither may start another preview pass.
    fireEvent.press(screen.getByTestId('data-preview-merge'));
    fireEvent.press(screen.getByTestId('data-preview-replace'));
    expect(mockedPreviewImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('data-preview-merge').props.accessibilityState?.disabled).toBe(true);

    release(validPreview('merge'));

    // The single in-flight preview still lands and clears the busy state.
    await waitFor(() =>
      expect(screen.getByTestId('data-preview-output')).toBeOnTheScreen(),
    );
    expect(mockedPreviewImport).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('data-preview-merge').props.accessibilityState?.disabled).toBe(false),
    );
  });

  it('allows a fresh preview after the previous one settles (guard resets)', async () => {
    mockedPreviewImport.mockResolvedValue(validPreview('merge'));
    await renderScreen();
    await typeImportJson();

    fireEvent.press(await screen.findByTestId('data-preview-merge'));
    await waitFor(() => expect(mockedPreviewImport).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('data-preview-merge').props.accessibilityState?.disabled).toBe(false),
    );

    fireEvent.press(screen.getByTestId('data-preview-merge'));
    await waitFor(() => expect(mockedPreviewImport).toHaveBeenCalledTimes(2));
  });
});
