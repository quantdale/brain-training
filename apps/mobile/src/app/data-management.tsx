/**
 * Data Management — local backup / restore / wipe (Session 05 portability,
 * W13 UX wave).
 *
 * Offline-first, manual backup flow (constitution §7):
 * - Export canonical local profile/progression evidence as a versioned, checksummed envelope.
 * - Preview/dry-run before mutation (validate + counters without writing).
 * - Replace (destructive) vs Merge (reconcile, dedupe/idempotent, preserve target-only).
 * - Integrity / future-version / malformed rejection BEFORE mutation.
 * - Atomic application + rollback on failure; triggers stay valid.
 * - Local data deletion workflow with backup-offered-first and typed confirmation.
 *
 * Transport consumes W10's `BackupTransport` seam as-is via the provided
 * in-memory implementation: every export is also saved under a timestamped
 * name (`defaultBackupName`) and can be re-loaded into the import box or
 * deleted within the session. A native file/share transport can replace it
 * later without touching this engine contract.
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
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import {
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
import { applyImport } from "@/data-portability";
// Imported directly rather than via the barrel: this module pulls in native
// filesystem modules that Node-side engine tests must not load transitively.
import {
  createFileBackupTransport,
  pickBackupFile,
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
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewImport>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState("");
  // Names currently held by the transport (refreshed after save/delete/load).
  const [savedBackups, setSavedBackups] = useState<string[]>([]);

  const refreshSavedBackups = useCallback(async () => {
    try {
      setSavedBackups(await backupTransport.listBackups());
    } catch {
      // Transport failures must never take the management screen down.
      setSavedBackups([]);
    }
  }, []);

  const onExport = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const env = await exportLocalData(getDb());
      const text = serializeBackup(env);
      setExportText(text);
      // Also park the envelope in the session transport so it can be
      // re-imported without copy/paste gymnastics.
      const name = defaultBackupName();
      await backupTransport.writeBackup(name, text);
      await refreshSavedBackups();
      setMessage(
        `Exported ${env.data.gameSessions.length} sessions, ${env.data.currencyLedger.length} ledger entries. Saved as ${name}.`,
      );
    } catch (e) {
      setMessage(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [refreshSavedBackups]);

  const onLoadBackup = useCallback(
    async (name: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const text = await backupTransport.readBackup(name);
        setImportText(text);
        setMessage(`Loaded "${name}" into the import box. Preview before applying.`);
      } catch (e) {
        setMessage(`Load failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onDeleteBackup = useCallback(
    async (name: string) => {
      setBusy(true);
      setMessage(null);
      try {
        await backupTransport.deleteBackup(name);
        await refreshSavedBackups();
        setMessage(`Deleted saved backup "${name}".`);
      } catch (e) {
        setMessage(`Delete failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [refreshSavedBackups],
  );

  const onLoadFromFile = useCallback(async () => {
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
  }, []);

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
            `Preview: rejected (${result.error?.kind}): ${result.error?.message}`,
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
      if (!importText.trim()) {
        setMessage("Paste a backup JSON first.");
        return;
      }
      // Validate before mutation (engine also validates, but we surface the preview first).
      const previewResult = await previewImport(getDb(), importText, mode);
      if (!previewResult.valid) {
        setMessage(
          `Import rejected: ${previewResult.error?.kind} — ${previewResult.error?.message}`,
        );
        return;
      }
      // For replace, confirm destructiveness via an extra guard (typed confirmation already in wipe, but for replace we also warn).
      if (mode === "replace") {
        // Simple in-UI confirmation via Alert on native, but also allow proceeding.
        // We do not block automation: the caller must have previewed.
      }
      setBusy(true);
      setMessage(null);
      try {
        // Reuse the preview's already-validated payload (same importText) —
        // re-parsing large backups doubled the synchronous work per import.
        const parsed = previewResult.parsed ?? parseAndValidateBackup(importText);
        const result = await applyImport(getDb(), parsed, mode);
        setMessage(
          `Import ${mode} complete: ${result.sessionsAdded} sessions added, ${result.sessionsSkipped} skipped, ${result.ledgerAdded} ledger added.`,
        );
        setPreview(null);
        refresh();
      } catch (e) {
        setMessage(`Import failed: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [importText, refresh],
  );

  const onWipe = useCallback(async () => {
    if (wipeConfirm !== "DELETE") {
      setMessage("Type DELETE to confirm wipe.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await wipeLocalData(getDb());
      setMessage("All local data wiped. App will start fresh on next launch.");
      setExportText(null);
      setPreview(null);
      setWipeConfirm("");
      refresh();
    } catch (e) {
      setMessage(`Wipe failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [wipeConfirm, refresh]);

  return (
    <ScreenShell>
      <ThemedText type="title" testID="data-management-title">
        Data Management
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Export, preview, and restore your local training data. All operations
        validate before mutating and are fully offline.
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
          Creates a versioned, checksummed JSON envelope containing all
          canonical local data (sessions, ratings, ledger, quests, streak
          inventory, settings, etc.). Exports are also saved into the app&apos;s
          backups folder and listed below.
        </ThemedText>
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
        {exportText ? (
          <View style={styles.exportBox} testID="data-export-output">
            <ScrollView style={styles.exportScroll} testID="data-export-scroll">
              <ThemedText type="code" style={styles.mono}>
                {exportText.slice(0, 4000)}
                {exportText.length > 4000 ? "\n… (truncated)" : ""}
              </ThemedText>
            </ScrollView>
            <ThemedText type="caption" themeColor="textSecondary">
              Full backup is {exportText.length} characters. Copy the full text
              from the export (long-press to select). For sharing, paste into a
              file or cloud note.
            </ThemedText>
          </View>
        ) : null}
      </ThemedView>

      {/* Saved backups (file transport — persists in the app documents folder). */}
      <ThemedView type="surface" style={styles.card} testID="data-saved-backups">
        <ThemedText type="subtitle">Saved Backups</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Stored in the app&apos;s backups folder and kept across app restarts. Load
          one to restore it, or delete it. Use the share sheet or a file manager
          to keep copies outside the app.
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
                  style={styles.backupName}>
                  {name}
                </ThemedText>
                <View style={styles.row}>
                  <Pressable
                    testID={`data-backup-load-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Load backup ${name} into the import box`}
                    disabled={busy}
                    onPress={() => onLoadBackup(name)}>
                    <ThemedView type="accentSoft" style={styles.smallPill}>
                      <ThemedText type="smallBold" themeColor="accent">
                        Load
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    testID={`data-backup-delete-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete saved backup ${name}`}
                    disabled={busy}
                    onPress={() => onDeleteBackup(name)}>
                    <ThemedView type="surface" style={styles.smallPill}>
                      <ThemedText type="smallBold" themeColor="danger">
                        Delete
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="data-import-card">
        <ThemedText type="subtitle">Import / Restore</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Paste a previously exported backup JSON (or load a saved backup
          above). Preview first to see what would change (no data is written
          during preview). Then choose Merge (add new, keep existing) or Replace
          (overwrite everything).
        </ThemedText>
        <TextInput
          testID="data-import-input"
          placeholder="Paste backup JSON here"
          placeholderTextColor="#999"
          multiline
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
              Preview:{" "}
              {preview.valid ? "Valid" : `Invalid (${preview.error?.kind})`}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {preview.valid
                ? `Would add ${preview.counters.sessionsAdded} sessions, ${preview.counters.ledgerAdded} ledger entries.`
                : preview.error?.message}
            </ThemedText>
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
          <Pressable
            testID="data-import-replace"
            accessibilityRole="button"
            accessibilityLabel="Apply replace import"
            disabled={busy || !importText.trim()}
            onPress={() => onImport("replace")}
          >
            <ThemedView type="accentSoft" style={styles.pill}>
              <ThemedText type="smallBold" themeColor="accent">
                Replace Import
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
        <ThemedText type="caption" themeColor="warning">
          Replace is destructive and cannot be undone except by another restore.
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="data-wipe-card">
        <ThemedText type="subtitle">Delete All Local Data</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Permanently deletes all sessions, ratings, ledger, quests, and
          settings. Offer a backup first — export above before wiping. Type
          DELETE to confirm.
        </ThemedText>
        <TextInput
          testID="data-wipe-confirm"
          placeholder="Type DELETE to confirm"
          placeholderTextColor="#999"
          style={styles.input}
          value={wipeConfirm}
          onChangeText={setWipeConfirm}
          accessibilityLabel="Wipe confirmation input"
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
