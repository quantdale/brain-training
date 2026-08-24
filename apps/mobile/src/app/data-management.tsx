/**
 * Data Management — local backup / restore / wipe (Session 05 portability,
 * matured in campaign 012 W12).
 *
 * Offline-first, manual backup flow (constitution §7):
 * - Export canonical local profile/progression evidence as a versioned, checksummed envelope.
 * - Preview/dry-run before mutation (validate + counters without writing).
 * - Replace (destructive) vs Merge (reconcile, dedupe/idempotent, preserve target-only).
 * - Integrity / future-version / malformed rejection BEFORE mutation.
 * - Atomic application + rollback on failure; triggers stay valid.
 * - Local data deletion workflow with backup-offered-first and typed confirmation.
 *
 * UX contract (W12):
 * - Device-local honesty: every explanation states that data lives only on
 *   this phone; there is no account or cloud sync to fall back on.
 * - Destructive actions are two-tap (Replace import, per-backup Delete) using
 *   the shared ConfirmButton — same arm/confirm pattern as reward purchases.
 * - The share sheet is offered where available; when the platform reports it
 *   unavailable we say so plainly instead of failing silently.
 *
 * Transport consumes W10's `BackupTransport` seam via the file-backed
 * implementation: every export is also saved under a timestamped name
 * (`defaultBackupName`) inside the app's document directory and survives
 * restarts. A native transport can replace it later without touching this
 * engine contract.
 */

import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import { ScreenShell } from "@/components/screen-shell";
import { ConfirmButton } from "@/components/settings/confirm-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import {
  applyImport,
  countLocalData,
  defaultBackupName,
  exportLocalData,
  parseAndValidateBackup,
  previewImport,
  serializeBackup,
  wipeLocalData,
  type BackupTransport,
  type LocalDataCounts,
} from "@/data-portability";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
// Imported directly rather than via the barrel: this module pulls in native
// filesystem modules that Node-side engine tests must not load transitively.
// The native requires inside are LAZY (campaign 011 fix), so importing this
// module — even at route-table startup — never touches native code until an
// export/import/pick/share operation actually runs.
import {
  createFileBackupTransport,
  pickBackupFile,
  shareBackupFile,
} from "@/data-portability/file-transport";

// Durable backup store (Campaign 010 file transport, debt D2): saved backups
// live under the app document directory and survive restarts. Import can also
// source files from outside the sandbox via the document picker.
const backupTransport: BackupTransport = createFileBackupTransport();

const EMPTY_COUNTS: LocalDataCounts = {
  gameSessions: 0,
  domainRatings: 0,
  ratingHistory: 0,
  currencyLedger: 0,
  gameFavorites: 0,
  xpAwards: 0,
  tutorialState: 0,
  workoutInstances: 0,
  questDefinitions: 0,
  questProgress: 0,
  achievementDefinitions: 0,
  achievementUnlocks: 0,
  hasProfile: false,
};

async function loadCounts(): Promise<LocalDataCounts> {
  return countLocalData(getDb());
}

export default function DataManagementScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: counts } = useDbData(loadCounts, [refreshKey], EMPTY_COUNTS);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const [exportText, setExportText] = useState<string | null>(null);
  const [lastExportName, setLastExportName] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewImport>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState("");
  // Names currently held by the transport. Loaded through the shared db-data
  // hook so backups saved by earlier sessions are visible on arrival and the
  // inventory re-lists whenever `refreshKey` bumps (save/delete/load).
  const loadSavedBackups = useCallback(async () => {
    try {
      return await backupTransport.listBackups();
    } catch {
      // Transport failures must never take the management screen down.
      return [];
    }
  }, []);
  const { data: savedBackups } = useDbData(loadSavedBackups, [refreshKey], []);

  const onExport = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const env = await exportLocalData(getDb());
      const text = serializeBackup(env);
      setExportText(text);
      // Also park the envelope in the durable transport so a copy survives
      // even if the user never shares it off-device.
      const name = defaultBackupName();
      await backupTransport.writeBackup(name, text);
      setLastExportName(name);
      refresh();
      setMessage(
        `Exported ${env.data.gameSessions.length} sessions and ${env.data.currencyLedger.length} ledger entries. Saved on this phone as ${name}.`,
      );
    } catch (e) {
      setLastExportName(null);
      setMessage(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  /** Offer the fresh/saved export to the system share sheet when present. */
  const onShareBackup = useCallback(async (name: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const shared = await shareBackupFile(name);
      setMessage(
        shared
          ? `Backup "${name}" handed to the system share sheet.`
          : `Sharing isn't available on this device. Use your file manager to copy "${name}" out of this app's backups folder.`,
      );
    } catch (e) {
      setMessage(`Share failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onLoadBackup = useCallback(
    async (name: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        const text = await backupTransport.readBackup(name);
        setImportText(text);
        setMessage(
          `Loaded "${name}" into the import box. Preview before applying.`,
        );
      } catch (e) {
        setMessage(`Load failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const onDeleteBackup = useCallback(
    async (name: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        await backupTransport.deleteBackup(name);
        refresh();
        setMessage(`Deleted saved backup "${name}".`);
      } catch (e) {
        setMessage(`Delete failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const onLoadFromFile = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickBackupFile();
      if (!picked) {
        // User canceled the picker — not an error.
        setMessage(null);
        return;
      }
      setImportText(picked.text);
      setMessage(
        `Loaded "${picked.name}" into the import box. Preview before applying.`,
      );
    } catch (e) {
      setMessage(`File load failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onPreview = useCallback(
    async (mode: "merge" | "replace") => {
      if (!importText.trim()) {
        setMessage("Paste a backup JSON first.");
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        const result = await previewImport(getDb(), importText, mode);
        setPreview(result);
        if (!result.valid) {
          setMessage(
            `Preview rejected (${result.error?.kind}): ${result.error?.message}`,
          );
        } else {
          setMessage(
            `Preview ${mode}: ${result.counters.sessionsAdded} sessions would be added, ${result.counters.sessionsSkipped} skipped. ${result.notes[0] ?? ""}`,
          );
        }
      } catch (e) {
        setMessage(`Preview failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [importText],
  );

  const onImport = useCallback(
    async (mode: "merge" | "replace") => {
      if (busy) {
        return;
      }
      if (!importText.trim()) {
        setMessage("Paste a backup JSON first.");
        return;
      }
      // Validate before mutation (the engine validates again inside its own
      // transaction; this pass surfaces typed rejections without writing).
      setBusy(true);
      setMessage(null);
      try {
        const previewResult = await previewImport(getDb(), importText, mode);
        if (!previewResult.valid) {
          setMessage(
            `Import rejected: ${previewResult.error?.kind} — ${previewResult.error?.message}`,
          );
          return;
        }
        // Reuse the preview's already-validated payload (same importText) —
        // re-parsing large backups doubled the synchronous work per import.
        const parsed =
          previewResult.parsed ?? parseAndValidateBackup(importText);
        const result = await applyImport(getDb(), parsed, mode);
        setMessage(
          mode === "replace"
            ? `Replace complete: current data was erased and ${result.sessionsAdded} sessions restored (${result.sessionsSkipped} skipped, ${result.ledgerAdded} ledger entries added).`
            : `Merge complete: ${result.sessionsAdded} sessions added, ${result.sessionsSkipped} skipped, ${result.ledgerAdded} ledger entries added.`,
        );
        setPreview(null);
        refresh();
      } catch (e) {
        setMessage(`Import failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, importText, refresh],
  );

  const onWipe = useCallback(async () => {
    if (busy) {
      return;
    }
    if (wipeConfirm !== "DELETE") {
      setMessage("Type DELETE to confirm wiping all local data.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await wipeLocalData(getDb());
      setMessage(
        "All local training data wiped. Saved backup files were kept — restore one any time.",
      );
      setExportText(null);
      setLastExportName(null);
      setPreview(null);
      setWipeConfirm("");
      refresh();
    } catch (e) {
      setMessage(`Wipe failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, wipeConfirm]);

  return (
    <ScreenShell>
      <ThemedText type="title" testID="data-management-title">
        Data Management
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Your training history lives only on this phone — there is no account or
        cloud copy. Export a backup file you control, preview exactly what a
        restore would change, and delete local data only when you mean it. All
        operations validate before they write and work fully offline.
      </ThemedText>

      <ThemedView type="surface" style={styles.card} testID="data-counts">
        <ThemedText type="subtitle">Local Data</ThemedText>
        <View style={styles.countGrid}>
          <Count
            label="Sessions"
            value={counts.gameSessions}
            testID="data-count-sessions"
          />
          <Count
            label="Ratings"
            value={counts.domainRatings}
            testID="data-count-ratings"
          />
          <Count
            label="History"
            value={counts.ratingHistory}
            testID="data-count-history"
          />
          <Count
            label="Ledger"
            value={counts.currencyLedger}
            testID="data-count-ledger"
          />
          <Count
            label="Favorites"
            value={counts.gameFavorites}
            testID="data-count-favorites"
          />
          <Count
            label="Quests"
            value={counts.questProgress}
            testID="data-count-quests"
          />
          <Count
            label="XP awards"
            value={counts.xpAwards}
            testID="data-count-xp"
          />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {counts.hasProfile ? "Profile present" : "No profile"} ·{" "}
          {counts.workoutInstances} workout instances · {counts.tutorialState}{" "}
          tutorial states
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="data-export-card">
        <ThemedText type="subtitle">Export Backup</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Creates one versioned, checksummed JSON file containing your full
          local training history: sessions, ratings, coins, quests,
          achievements, streak inventory and settings. It is saved in this
          app&apos;s backups folder on your phone; nothing is uploaded
          anywhere. Use Share to put a copy outside the app.
        </ThemedText>
        <View style={styles.row}>
          <Pressable
            testID="data-export-button"
            accessibilityRole="button"
            accessibilityLabel="Export backup to JSON"
            disabled={busy}
            onPress={onExport}
            style={styles.button}
          >
            <ThemedView type="accentSoft" style={styles.pill}>
              <ThemedText type="smallBold" themeColor="accent">
                {busy ? "Working…" : "Export to JSON"}
              </ThemedText>
            </ThemedView>
          </Pressable>
          {lastExportName && !busy ? (
            <Pressable
              testID={`data-export-share-${lastExportName}`}
              accessibilityRole="button"
              accessibilityLabel={`Share the exported backup ${lastExportName}`}
              onPress={() => onShareBackup(lastExportName)}
              style={styles.button}
            >
              <ThemedView type="surface" style={styles.smallPill}>
                <ThemedText type="smallBold">Share…</ThemedText>
              </ThemedView>
            </Pressable>
          ) : null}
        </View>
        {exportText ? (
          <View style={styles.exportBox} testID="data-export-output">
            <ScrollView style={styles.exportScroll} testID="data-export-scroll">
              <ThemedText type="code" style={styles.mono}>
                {exportText.slice(0, 4000)}
                {exportText.length > 4000 ? "\n… (truncated)" : ""}
              </ThemedText>
            </ScrollView>
            <ThemedText type="caption" themeColor="textSecondary">
              Full backup is {exportText.length} characters. This preview is
              truncated — share the file or load it from Saved Backups instead
              of copying by hand.
            </ThemedText>
          </View>
        ) : null}
      </ThemedView>

      {/* Saved backups (file transport — persists in the app documents folder). */}
      <ThemedView
        type="surface"
        style={styles.card}
        testID="data-saved-backups"
      >
        <ThemedText type="subtitle">Saved Backups</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Plain JSON files in this app&apos;s backups folder on your phone.
          They survive restarts and are NOT removed by deleting your training
          data below. For real safety keep a copy outside the device (Share).
        </ThemedText>
        {savedBackups.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No saved backups yet. Export above to create one.
          </ThemedText>
        ) : (
          <View style={styles.rows}>
            {savedBackups.map((name) => (
              <View key={name} style={styles.backupRow}>
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  style={styles.backupName}
                >
                  {name}
                </ThemedText>
                <View style={styles.row}>
                  <Pressable
                    testID={`data-backup-load-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Load backup ${name} into the import box`}
                    disabled={busy}
                    onPress={() => onLoadBackup(name)}
                  >
                    <ThemedView type="accentSoft" style={styles.smallPill}>
                      <ThemedText type="smallBold" themeColor="accent">
                        Load
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    testID={`data-backup-share-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Share saved backup ${name}`}
                    disabled={busy}
                    onPress={() => onShareBackup(name)}
                  >
                    <ThemedView type="surface" style={styles.smallPill}>
                      <ThemedText type="smallBold">Share</ThemedText>
                    </ThemedView>
                  </Pressable>
                  {/* Deleting a backup is destructive and irreversible —
                      require the confirming second tap. */}
                  <ConfirmButton
                    testID={`data-backup-delete-${name}`}
                    label="Delete"
                    confirmLabel="Tap to confirm"
                    accessibilityLabel={`Delete saved backup ${name}`}
                    variant="danger"
                    size="small"
                    disabled={busy}
                    onConfirm={() => void onDeleteBackup(name)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="data-import-card">
        <ThemedText type="subtitle">Import / Restore</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Paste a previously exported backup JSON (or load a saved backup or
          file below), then preview — previews never write data.
        </ThemedText>
        <View style={styles.modeBox} testID="data-import-modes">
          <ThemedText type="smallBold">Merge</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Adds what the backup contains that your phone is missing. Nothing
            currently on the phone is deleted or overwritten.
          </ThemedText>
          <ThemedText type="smallBold">Replace</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Erases your current local data first, then restores exactly what is
            in the backup. Anything not in the backup is gone permanently.
          </ThemedText>
        </View>
        <TextInput
          testID="data-import-input"
          placeholder="Paste backup JSON here"
          placeholderTextColor="#999"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.textArea}
          value={importText}
          onChangeText={setImportText}
          accessibilityLabel="Backup JSON input"
        />
        <View style={styles.row}>
          <Pressable
            testID="data-import-from-file"
            accessibilityRole="button"
            accessibilityLabel="Load backup JSON from a file"
            disabled={busy}
            onPress={onLoadFromFile}
          >
            <ThemedView type="surface" style={styles.smallPill}>
              <ThemedText type="smallBold">Load from file…</ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable
            testID="data-preview-merge"
            accessibilityRole="button"
            accessibilityLabel="Preview merge import"
            disabled={busy || !importText.trim()}
            onPress={() => onPreview("merge")}
          >
            <ThemedView type="surface" style={styles.smallPill}>
              <ThemedText type="smallBold">Preview Merge</ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable
            testID="data-preview-replace"
            accessibilityRole="button"
            accessibilityLabel="Preview replace import"
            disabled={busy || !importText.trim()}
            onPress={() => onPreview("replace")}
          >
            <ThemedView type="surface" style={styles.smallPill}>
              <ThemedText type="smallBold">Preview Replace</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
        {preview ? (
          <View
            style={styles.previewBox}
            testID="data-preview-output"
            accessibilityLiveRegion="polite"
          >
            <ThemedText type="smallBold">
              Preview ({preview.mode}):{" "}
              {preview.valid ? "Valid" : `Invalid (${preview.error?.kind})`}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {preview.valid
                ? `Would add ${preview.counters.sessionsAdded} sessions and ${preview.counters.ledgerAdded} ledger entries${preview.mode === "replace" ? " after erasing current data" : ""}.`
                : preview.error?.message}
            </ThemedText>
            {preview.mode === "replace" && (
              <ThemedText type="caption" themeColor="warning">
                Replace erases everything currently on this phone before
                restoring the backup.
              </ThemedText>
            )}
            {preview.notes.map((n, i) => (
              <ThemedText key={i} type="caption" themeColor="textSecondary">
                • {n}
              </ThemedText>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <Pressable
            testID="data-import-merge"
            accessibilityRole="button"
            accessibilityLabel="Apply merge import"
            disabled={busy || !importText.trim()}
            onPress={() => onImport("merge")}
          >
            <ThemedView type="accentSoft" style={styles.pill}>
              <ThemedText type="smallBold" themeColor="accent">
                Merge Import
              </ThemedText>
            </ThemedView>
          </Pressable>
          {/* Replace is destructive: first tap arms ("Tap again…"), second
              tap applies. Same pattern as deleting saved backups. */}
          <ConfirmButton
            testID="data-import-replace"
            label="Replace Import"
            confirmLabel="Tap again to erase and restore"
            accessibilityLabel="Apply replace import"
            variant="danger"
            disabled={busy || !importText.trim()}
            onConfirm={() => void onImport("replace")}
          />
        </View>
        <ThemedText type="caption" themeColor="warning">
          Replace cannot be undone except by restoring another backup. Not sure
          which mode you need? Merge is always safe.
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="data-wipe-card">
        <ThemedText type="subtitle">Delete All Local Data</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Permanently deletes every session, rating, coin ledger entry, quest,
          achievement and setting on this phone. There is no cloud copy to fall
          back on. Export a backup first — you cannot undo this unless you have
          one.
        </ThemedText>
        <View style={styles.row}>
          <Pressable
            testID="data-wipe-export-first"
            accessibilityRole="button"
            accessibilityLabel="Export a backup before deleting anything"
            disabled={busy}
            onPress={onExport}
          >
            <ThemedView type="accentSoft" style={styles.pill}>
              <ThemedText type="smallBold" themeColor="accent">
                Export a backup first
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
        <TextInput
          testID="data-wipe-confirm"
          placeholder="Type DELETE to confirm"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          value={wipeConfirm}
          onChangeText={setWipeConfirm}
          accessibilityLabel="Wipe confirmation input"
          accessibilityHint='Typing DELETE enables the wipe button below'
        />
        <Pressable
          testID="data-wipe-button"
          accessibilityRole="button"
          accessibilityLabel="Wipe all local data"
          disabled={busy || wipeConfirm !== "DELETE"}
          onPress={onWipe}
        >
          <ThemedView
            type={wipeConfirm === "DELETE" ? "danger" : "surface"}
            style={styles.pill}
          >
            <ThemedText
              type="smallBold"
              themeColor={wipeConfirm === "DELETE" ? "danger" : "textSecondary"}
            >
              Wipe Local Data
            </ThemedText>
          </ThemedView>
        </Pressable>
        <ThemedText type="caption" themeColor="textSecondary">
          Saved backup files are kept by the wipe — restore one from Saved
          Backups if you change your mind.
        </ThemedText>
      </ThemedView>

      {message ? (
        <ThemedView
          type="surface"
          style={styles.card}
          testID="data-message"
          accessibilityLiveRegion="polite"
        >
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        </ThemedView>
      ) : null}
    </ScreenShell>
  );
}

function Count({
  label,
  value,
  testID,
}: {
  label: string;
  value: number;
  testID: string;
}) {
  return (
    <View style={styles.countCell} testID={testID}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  countCell: {
    minWidth: 80,
    alignItems: "center",
    gap: Spacing.half,
  },
  button: {
    alignSelf: "flex-start",
  },
  pill: {
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  smallPill: {
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.two,
  },
  backupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  backupName: {
    flex: 1,
  },
  modeBox: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Radii.medium,
    backgroundColor: "rgba(120,120,140,0.08)",
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
    borderRadius: Radii.medium,
    padding: Spacing.two,
    textAlignVertical: "top",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
    borderRadius: Radii.medium,
    padding: Spacing.two,
  },
  exportBox: {
    gap: Spacing.two,
  },
  exportScroll: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
    borderRadius: Radii.medium,
    padding: Spacing.two,
  },
  mono: {
    fontSize: 10,
  },
  previewBox: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Radii.medium,
    backgroundColor: "rgba(120,120,140,0.08)",
  },
});
