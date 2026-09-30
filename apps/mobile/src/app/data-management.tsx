/**
 * Data Management — local backup / restore / wipe (Session 05 portability,
 * campaign 012 W12 maturity).
 *
 * - Everything is local-first: backups live in the app documents folder via a
 *   file transport; the app itself uploads nothing (the OS device backup
 *   may still carry exported files — see the Data Management header copy).
 * - Previews never write; Replace/Delete are two-tap (shared ConfirmButton);
 *   wipe additionally requires typing DELETE.
 * - Destructive actions are two-tap (Replace import, per-backup Delete) using
 *   the shared ConfirmButton — same arm/confirm pattern as reward purchases.
 * - The share sheet is offered where available; when the platform reports it
 *   unavailable we say so plainly instead of failing silently.
 *
 * Presentation (campaign 026, design-language v3 "Neon Arcade"): a
 * storage-summary hero leads with the accent spark; every card header carries
 * a family identity mark (export info, backups accent, import xp, wipe
 * danger); the backup list and import modes are `ListRow`s with identity
 * icons; the empty backups state is designed (spark + headline + one line);
 * the destructive wipe stays a danger action gated by the typed DELETE
 * confirmation.
 */

import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { ConfirmButton } from "@/components/settings/confirm-button";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, Typography, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { BackLink, useSafeBack } from "@/components/ui/back-link";
import {
  Button,
  Card,
  EmptyState,
  Entrance,
  HAIRLINE,
  ListRow,
  Skeleton,
  Spark,
  StatBlock,
  TextField,
} from "@/components/ui";
import {
  applyImport,
  countLocalData,
  defaultBackupName,
  exportLocalDataBundle,
  MAX_BACKUP_TEXT_LENGTH,
  parseAndValidateBackup,
  previewImport,
  wipeLocalData,
  type BackupTransport,
  type ImportPreview,
  type LocalDataCounts,
} from "@/data-portability";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { refreshProgression } from "@/progression";
import { emitWorkoutChanged } from "@/workout/events";
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
  storageBytes: 0,
};

async function loadCounts(): Promise<LocalDataCounts> {
  return countLocalData(getDb());
}

export default function DataManagementScreen() {
  const theme = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  // 072: the shared empty-stack fallback, so a cold deep link into this
  // screen lands on Profile instead of stranding the user.
  const goBack = useSafeBack('/profile');
  // 072: the counts and the backup inventory are separate reads and BOTH can
  // fail. Each carries its own status so a failed read can never be painted as
  // "you have no backups" / "nothing to delete" — a claim the user would act on.
  const { data: counts, status: countsStatus, retry: retryCounts } = useDbData(
    loadCounts,
    [refreshKey],
    EMPTY_COUNTS,
    { label: 'data-management/counts' },
  );
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  // The SQLite backend may be unable to report PRAGMA page metrics even when
  // initialization has created the local profile/catalog/workout state. Do
  // not call that populated local store "Empty"; the exact table counts below
  // remain the source of truth for what is actually present.
  const hasInitializedLocalState =
    counts.hasProfile ||
    [
      counts.gameSessions,
      counts.domainRatings,
      counts.ratingHistory,
      counts.currencyLedger,
      counts.gameFavorites,
      counts.xpAwards,
      counts.tutorialState,
      counts.workoutInstances,
      counts.questDefinitions,
      counts.questProgress,
      counts.achievementDefinitions,
      counts.achievementUnlocks,
    ].some((count) => count > 0);
  const storageSummary =
    counts.storageBytes > 0
      ? `${(counts.storageBytes / 1024).toFixed(1)} KB`
      : hasInitializedLocalState
        ? "Ready"
        : "Empty";
  const [backupName, setBackupName] = useState("");
  const [exportText, setExportText] = useState<string | null>(null);
  const [lastExportName, setLastExportName] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState("");
  // Names currently held by the transport. Loaded through the shared db-data
  // hook so backups saved by earlier sessions are visible on arrival and the
  // inventory re-lists whenever `refreshKey` bumps (save/delete/load).
  const loadSavedBackups = useCallback(async () => {
    // 072: the previous `catch { return [] }` was THE reason a failed read
    // rendered as "you have no backups". The hook could not distinguish a real
    // empty folder from a storage failure, because this handler converted one
    // into the other before the hook ever saw it. The failure is re-thrown so
    // the hook reports `status: 'error'` and the screen renders its failure
    // state with a retry — which is where "must never take the screen down"
    // is actually satisfied. Swallowing it here only moved the failure
    // somewhere it could not be seen.
    return backupTransport.listBackups();
  }, []);
  const {
    data: savedBackups,
    status: backupsStatus,
    retry: retryBackups,
  } = useDbData(loadSavedBackups, [refreshKey], [], {
    isEmpty: (names) => names.length === 0,
    label: 'data-management/backups',
  });

  // 070: files the transport hides but cannot safely delete. Either an
  // interrupted backup replacement that left only its rotation copy, or a
  // backup an EARLIER build saved under a name the current listing rule hides —
  // in both cases a file the app once reported as saved and can now neither
  // show nor restore. Reported with an explicit delete control rather than
  // cleaned up silently, because the only remaining copy of a backup is not the
  // app's to destroy.
  const loadStrandedArtifacts = useCallback(async (): Promise<string[]> => {
    // Same reasoning as `loadSavedBackups`: a failure here is reported, not
    // converted into "there are no stranded files", which would tell a user
    // whose backup is stuck that everything is fine.
    if (!backupTransport.listStrandedArtifacts) return [];
    return backupTransport.listStrandedArtifacts();
  }, []);
  const { data: strandedArtifacts } = useDbData(
    loadStrandedArtifacts,
    [refreshKey],
    [],
    { label: 'data-management/stranded' },
  );
  const onDeleteStranded = useCallback(
    async (name: string) => {
      if (busy) return;
      setBusy(true);
      setMessage(null);
      try {
        await backupTransport.deleteStrandedArtifact?.(name);
        setMessage(
          `Removed hidden file "${name}". Its backup content is gone; export a new backup if you need one.`,
        );
      } catch (e) {
        setMessage(`Could not remove "${name}": ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const onExport = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // Single-pass export: snapshot + canonical serialization happen in ONE
      // walk of the data (`exportLocalDataBundle`), not export-then-serialize.
      const { envelope, text } = await exportLocalDataBundle(getDb());
      setExportText(text);
      // Also park the envelope in the durable transport so a copy survives
      // even if the user never shares it off-device. A typed name wins;
      // blank falls back to the generated default. The current inventory is
      // passed in so a generated name can never silently overwrite an
      // earlier export taken within the same clock second.
      const name = backupName.trim() || defaultBackupName(new Date(), savedBackups);
      await backupTransport.writeBackup(name, text);
      setLastExportName(name);
      refresh();
      setMessage(
        `Exported ${envelope.data.gameSessions.length} sessions and ${envelope.data.currencyLedger.length} ledger entries. Saved on this phone as ${name}.`,
      );
    } catch (e) {
      setLastExportName(null);
      setMessage(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [backupName, busy, refresh, savedBackups]);

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
      // Same in-flight guard as the sibling handlers: a fast double-tap (or a
      // re-entrant dispatch racing the disabled state) must not start a second
      // preview pass while one is still running.
      if (busy) {
        return;
      }
      if (!importText.trim()) {
        setMessage("Paste a backup JSON first.");
        return;
      }
      // 062: refuse oversized pastes before preview parsing materializes
      // multiples of the text in memory (parse + canonical copy).
      if (importText.length > MAX_BACKUP_TEXT_LENGTH) {
        setMessage(
          `That text is too large to preview (limit ${MAX_BACKUP_TEXT_LENGTH} characters). Load it from a file instead — large files are size-checked before reading.`,
        );
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
        } else if (result.forwardCompatibility?.lossy) {
          // 070: the lossy notice LEADS, not the counter line. A user who sees
          // "142 sessions would be added" and scrolls past a warning will
          // import anyway; the number is what makes proceeding feel safe. The
          // warning is the thing that makes it not.
          setMessage(
            `Preview ${mode}: this backup was written by a NEWER version of the app. ` +
              `${result.forwardCompatibility.summary} ` +
              `You can cancel by clearing the backup text.`,
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
    [busy, importText],
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
      // 062: same oversized-paste refusal as preview (import re-validates
      // through previewImport, which would otherwise parse the huge text).
      if (importText.length > MAX_BACKUP_TEXT_LENGTH) {
        setMessage(
          `That text is too large to import (limit ${MAX_BACKUP_TEXT_LENGTH} characters). Load it from a file instead.`,
        );
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
        // 070: pass the forward-compat verdict the user was SHOWN, so the
        // result records exactly what was accepted rather than a second,
        // independently computed opinion. A lossy import is the user's choice,
        // not a failure — merge/replace proceed unchanged.
        const acknowledgedLossy = previewResult.forwardCompatibility?.lossy
          ? {
              count: previewResult.forwardCompatibility.items.length,
              summary: previewResult.forwardCompatibility.summary,
              paths: previewResult.forwardCompatibility.items.map((i) => i.path),
            }
          : undefined;
        const result = await applyImport(getDb(), parsed, mode, acknowledgedLossy);
        // 065: the import rewrote (replace) or added to (merge) persisted
        // workout rows behind mounted consumers' backs. Emit the existing
        // workout-changed signal so Home refetches instead of rendering a
        // deleted instance (dead Reroll, standalone save).
        emitWorkoutChanged();
        // A replace import erases definitions along with the rest of the data;
        // re-seed the singleton profile + catalogs in-process so the app is a
        // usable first-run product without a restart. Merges keep existing
        // definitions (and seed only when the fingerprint is stale).
        let restoreFailed = false;
        if (mode === "replace") {
          try {
            await refreshProgression(getDb());
          } catch (error) {
            restoreFailed = true;
            console.error("[data-management] post-replace progression restore failed", error);
          }
        }
        const suffix = restoreFailed
          ? " The default quest catalog could not be restored — reopen the app to retry."
          : "";
        setMessage(
          mode === "replace"
            ? `Replace complete: current data was erased and ${result.sessionsAdded} sessions restored (${result.sessionsSkipped} skipped, ${result.ledgerAdded} ledger entries added).${suffix}`
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
      // 065: every workout row is gone; mounted workout consumers must drop
      // the deleted instance and render the durable (empty) state.
      emitWorkoutChanged();
      // The wipe clears the profile and definition catalogs; restore the
      // singleton profile + versioned definitions in this same process so
      // Home/Profile/play stay usable without an app restart. Sessions, XP and
      // ledger rows stay empty (the engine's pure-clear semantics are kept).
      let restoreFailed = false;
      try {
        await refreshProgression(getDb());
      } catch (error) {
        restoreFailed = true;
        console.error("[data-management] post-wipe progression restore failed", error);
      }
      setMessage(
        restoreFailed
          ? "All local training data wiped, but the default catalog could not be restored. Reopen the app to retry."
          : "All local training data wiped. Saved backup files were kept — restore one any time.",
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
      {/* 072: this screen had no back affordance, so a user who deep-linked
          into it (or arrived from a cold start) had no way out but the tab
          bar. Profile is its only owning destination, which is also the
          fallback a cold deep-link landing needs. */}
      <BackLink
        testID="data-management-back"
        label="Profile"
        accessibilityLabel="Back to Profile"
        onPress={goBack}
      />
      <Entrance index={0}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="title" testID="data-management-title">
              Data Management
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Your training history lives in this app on this phone — there
              is no account copy. Files you export or share leave through
              the share sheet, and Android&apos;s own device backup may carry
              exported files to a new phone. Export a backup file you
              control, preview exactly what a restore would change, and
              delete local data only when you mean it. All operations
              validate before they write and work fully offline.
            </ThemedText>
          </View>
          <Spark size={30} color={theme.info} />
        </View>
      </Entrance>

      {countsStatus === 'loading' ? (
        <Card testID="data-loading">
          <Skeleton height={32} />
          <Skeleton />
          <Skeleton width="60%" />
        </Card>
      ) : countsStatus === 'error' ? (
        // 072: a failed count read must not render the storage hero and the
        // Local Data table built from the zeroed fallback. "0 sessions / 0
        // ledger entries" is a claim the user would act on.
        <Card testID="data-counts-error">
          <ThemedText type="body" themeColor="warning">
            Could not read your local data.
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            These numbers could not be loaded, so they are not shown. Your data
            is untouched — retry to read it again.
          </ThemedText>
          <Button
            label="Retry"
            variant="secondary"
            size="sm"
            testID="data-counts-retry"
            accessibilityLabel="Retry reading local data counts"
            disabled={busy}
            onPress={retryCounts}
          />
        </Card>
      ) : (
        <>
          {/* Storage-summary hero: the screen's metric. */}
          <Entrance index={1}>
            <Card variant="hero" testID="data-counts-hero">
              <View style={styles.heroRow}>
                <View style={styles.heroText}>
                  <StatBlock
                    label="Local database"
                    value={storageSummary}
                    valueType="numeralXl"
                    tone="accent"
                    testID="data-storage-summary"
                  />
                </View>
                <Spark size={44} color={theme.accent} />
              </View>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID="data-storage-size"
              >
                {counts.hasProfile ? "Profile present" : "No profile"} ·{" "}
                {counts.workoutInstances} workout instances ·{" "}
                {counts.tutorialState} tutorial states
              </ThemedText>
            </Card>
          </Entrance>

          <Entrance index={2}>
            <Card testID="data-counts">
              <CardHeader title="Local Data" soft="infoSoft" ink="infoText" />
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
            </Card>
          </Entrance>
        </>
      )}

      <Entrance index={3}>
        <Card testID="data-export-card">
          <CardHeader title="Export Backup" soft="infoSoft" ink="infoText" />
          <ThemedText type="caption" themeColor="textSecondary">
            Creates one versioned, checksummed JSON file containing your full
            local training history: sessions, ratings, coins, quests,
            achievements, streak inventory and settings. It is saved in this
            app&apos;s backups folder on your phone; the app itself uploads
            nothing. Use Share to put a copy outside the app.
          </ThemedText>
          <TextField
            label="Backup name"
            value={backupName}
            onChangeText={setBackupName}
            placeholder="Leave blank to auto-name"
            hint="Saved in this app's backups folder on your phone."
            onClear={() => setBackupName("")}
            testID="data-export-name"
          />
          <View style={styles.row}>
            <Button
              label="Export to JSON"
              variant="primary"
              size="md"
              fullWidth={false}
              loading={busy}
              testID="data-export-button"
              accessibilityLabel="Export backup to JSON"
              accessibilityHint="Saves a backup file on this phone"
              onPress={() => void onExport()}
            />
            {lastExportName && !busy ? (
              <Button
                label="Share…"
                variant="secondary"
                size="md"
                fullWidth={false}
                testID={`data-export-share-${lastExportName}`}
                accessibilityLabel={`Share the exported backup ${lastExportName}`}
                onPress={() => void onShareBackup(lastExportName)}
              />
            ) : null}
          </View>
          {exportText ? (
            <View style={styles.exportBox} testID="data-export-output">
              <ScrollView
                style={[styles.exportScroll, { borderColor: theme.border }]}
                testID="data-export-scroll"
              >
                <ThemedText type="code" style={styles.mono}>
                  {exportText.slice(0, 4000)}
                  {exportText.length > 4000 ? "\n… (truncated)" : ""}
                </ThemedText>
              </ScrollView>
              <ThemedText type="caption" themeColor="textSecondary">
                Full backup is {exportText.length} characters. This preview is
                truncated — share the file or load it from Saved Backups
                instead of copying by hand.
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Entrance>

      {/* Saved backups (file transport — persists in the app documents folder). */}
      <Entrance index={4}>
        <Card testID="data-saved-backups">
          <CardHeader
            title="Saved Backups"
            soft="accentSoft"
            ink="accentText"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Plain JSON files in this app&apos;s backups folder on your phone.
            They survive restarts and are NOT removed by deleting your training
            data below. For real safety keep a copy outside the device (Share).
          </ThemedText>
          {/* 072: four distinct outcomes. The pre-fix ternary had no failure
              branch, so a read that THREW rendered "No saved backups yet" —
              telling a user who may have six backups on disk that they have
              none. The empty state is now unreachable without a successful
              read that returned nothing. */}
          {backupsStatus === 'loading' ? (
            // A named, announced loading block: an untitled skeleton cannot be
            // asserted on and is invisible to a screen reader.
            <View
              testID="data-saved-backups-loading"
              accessible
              accessibilityLabel="Loading your saved backups"
            >
              <Skeleton />
            </View>
          ) : backupsStatus === 'error' ? (
            <View testID="data-saved-backups-error" style={styles.rows}>
              <ThemedText type="body" themeColor="warning">
                Could not read your saved backups.
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                This is a read failure, not an empty folder — your files may
                still be there. Retry before exporting or deleting anything.
              </ThemedText>
              <Button
                label="Retry"
                variant="secondary"
                size="sm"
                fullWidth={false}
                testID="data-saved-backups-retry"
                accessibilityLabel="Retry reading saved backups"
                disabled={busy}
                onPress={retryBackups}
              />
            </View>
          ) : backupsStatus === 'empty' ? (
            <EmptyState
              icon={<Spark size={22} color={theme.accent} />}
              title="No saved backups yet"
              message="Export above to create one."
              testID="data-saved-backups-empty"
            />
          ) : (
            <View style={styles.rows}>
              {savedBackups.map((name) => (
                <View key={name} style={styles.backupRow}>
                  <View style={styles.backupName}>
                    <ListRow
                      title={name}
                      icon={<Spark size={14} color={theme.infoText} />}
                      tone="infoSoft"
                      showChevron={false}
                    />
                  </View>
                  <View style={styles.row}>
                    <Button
                      label="Load"
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      testID={`data-backup-load-${name}`}
                      accessibilityLabel={`Load backup ${name} into the import box`}
                      disabled={busy}
                      onPress={() => void onLoadBackup(name)}
                    />
                    <Button
                      label="Share"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      testID={`data-backup-share-${name}`}
                      accessibilityLabel={`Share saved backup ${name}`}
                      disabled={busy}
                      onPress={() => void onShareBackup(name)}
                    />
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
          {strandedArtifacts.length > 0 ? (
            <View
              style={styles.rows}
              testID="data-stranded-artifacts"
              accessibilityLiveRegion="polite"
            >
              <ThemedText type="caption" themeColor="warning">
                {strandedArtifacts.length === 1
                  ? "1 hidden backup file was found that this list cannot show. "
                  : `${strandedArtifacts.length} hidden backup files were found that this list cannot show. `}
                It may be the only remaining copy of a backup whose replacement
                was interrupted. Recover it by exporting again, or delete it.
              </ThemedText>
              {strandedArtifacts.map((name) => (
                <View key={name} style={styles.backupRow}>
                  <View style={styles.backupName}>
                    <ListRow
                      title={name}
                      icon={<Spark size={14} color={theme.warningText} />}
                      tone="warningSoft"
                      showChevron={false}
                    />
                  </View>
                  {/* Destructive and irreversible — the shared two-tap
                      confirm, same as deleting a visible backup. */}
                  <ConfirmButton
                    testID={`data-stranded-delete-${name}`}
                    label="Delete"
                    confirmLabel="Tap to confirm"
                    accessibilityLabel={`Delete hidden backup file ${name}`}
                    variant="danger"
                    size="small"
                    disabled={busy}
                    onConfirm={() => void onDeleteStranded(name)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Entrance>

      <Entrance index={5}>
        <Card testID="data-import-card">
          <CardHeader
            title="Import / Restore"
            soft="xpSoft"
            ink="xpText"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Paste a previously exported backup JSON (or load a saved backup or
            file below), then preview — previews never write data.
          </ThemedText>
          {/* Mode rows carry their own identity: merge is safe (success),
              replace erases first (danger). */}
          <Card variant="outlined" padding="sm" testID="data-import-modes">
            <ListRow
              title="Merge"
              subtitle="Adds what the backup contains that your phone is missing. Nothing currently on the phone is deleted or overwritten."
              icon={<Spark size={16} color={theme.successText} />}
              tone="successSoft"
            />
            <ListRow
              title="Replace"
              subtitle="Erases your current local data first, then restores exactly what is in the backup. Anything not in the backup is gone permanently."
              icon={<Spark size={16} color={theme.dangerText} />}
              tone="dangerSoft"
            />
          </Card>
          <TextInput
            testID="data-import-input"
            placeholder="Paste backup JSON here"
            placeholderTextColor={theme.textMuted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            // 062: native-side cap matching the supported backup maximum —
            // equal-to-cap pastes still preview (deserialize uses `>`).
            maxLength={MAX_BACKUP_TEXT_LENGTH}
            style={[
              styles.textArea,
              {
                borderColor: theme.border,
                color: theme.text,
                fontSize: Typography.bodySmall.size,
              },
            ]}
            value={importText}
            onChangeText={setImportText}
            accessibilityLabel="Backup JSON input"
          />
          <View style={styles.row}>
            <Button
              label="Load from file…"
              variant="secondary"
              size="sm"
              fullWidth={false}
              testID="data-import-from-file"
              accessibilityLabel="Load backup JSON from a file"
              disabled={busy}
              onPress={() => void onLoadFromFile()}
            />
            <Button
              label="Preview Merge"
              variant="secondary"
              size="sm"
              fullWidth={false}
              testID="data-preview-merge"
              accessibilityLabel="Preview merge import"
              disabled={busy || !importText.trim()}
              onPress={() => void onPreview("merge")}
            />
            <Button
              label="Preview Replace"
              variant="secondary"
              size="sm"
              fullWidth={false}
              testID="data-preview-replace"
              accessibilityLabel="Preview replace import"
              disabled={busy || !importText.trim()}
              onPress={() => void onPreview("replace")}
            />
          </View>
          {preview ? (
            <Card
              variant="outlined"
              padding="sm"
              testID="data-preview-output"
              accessibilityLiveRegion="polite"
            >
              <ThemedText type="body">
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
              {preview.valid && preview.forwardCompatibility?.lossy && (
                // Rendered inline with the counters, not only in the transient
                // message above: that message is gone the moment the user
                // interacts, and this is a decision they must make with the
                // consequences in front of them.
                <ThemedText
                  type="caption"
                  themeColor="warning"
                  testID="data-preview-lossy-warning"
                  accessibilityLiveRegion="polite"
                >
                  {preview.forwardCompatibility.summary} Clear the backup text
                  above to cancel.
                </ThemedText>
              )}
              {preview.notes.map((n, i) => (
                <ThemedText key={i} type="caption" themeColor="textSecondary">
                  • {n}
                </ThemedText>
              ))}
            </Card>
          ) : null}
          <View style={styles.row}>
            <Button
              label="Merge Import"
              variant="primary"
              size="md"
              fullWidth={false}
              testID="data-import-merge"
              accessibilityLabel="Apply merge import"
              disabled={busy || !importText.trim()}
              onPress={() => void onImport("merge")}
            />
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
            Replace cannot be undone except by restoring another backup. Not
            sure which mode you need? Merge is always safe.
          </ThemedText>
        </Card>
      </Entrance>

      <Entrance index={6}>
        <Card testID="data-wipe-card">
          <CardHeader
            title="Delete All Local Data"
            soft="dangerSoft"
            ink="dangerText"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Permanently deletes every session, rating, coin ledger entry,
            quest, achievement and setting on this phone. There is no account
            or sync copy of your live data to fall back on. Export a backup
            first — you cannot undo this unless you have one.
          </ThemedText>
          <View style={styles.row}>
            <Button
              label="Export a backup first"
              variant="secondary"
              size="md"
              fullWidth={false}
              testID="data-wipe-export-first"
              accessibilityLabel="Export a backup before deleting anything"
              disabled={busy}
              onPress={() => void onExport()}
            />
          </View>
          <TextField
            label="Confirmation"
            value={wipeConfirm}
            // The kit field has no auto-caps; normalise so typing "delete" on
            // an auto-capitalising keyboard still arms the wipe, as before.
            onChangeText={(text) => setWipeConfirm(text.toUpperCase())}
            placeholder="Type DELETE to confirm"
            hint="Typing DELETE enables the wipe button below."
            testID="data-wipe-confirm"
            accessibilityLabel="Wipe confirmation input"
          />
          <Button
            label="Wipe Local Data"
            variant="danger"
            size="md"
            fullWidth={false}
            testID="data-wipe-button"
            accessibilityLabel="Wipe all local data"
            accessibilityHint={
              wipeConfirm === "DELETE"
                ? "Permanently deletes all local training data."
                : "Type DELETE above to enable."
            }
            disabled={busy || wipeConfirm !== "DELETE"}
            onPress={() => void onWipe()}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Saved backup files are kept by the wipe — restore one from Saved
            Backups if you change your mind.
          </ThemedText>
        </Card>
      </Entrance>

      {message ? (
        <Card testID="data-message" accessibilityLiveRegion="polite">
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        </Card>
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
  const theme = useTheme();
  return (
    <View
      style={[
        styles.countCell,
        { backgroundColor: theme.surfaceSunken, borderColor: theme.border },
      ]}
      testID={testID}
    >
      <ThemedText type="numeral" themeColor="accentText">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * Card header with an identity mark. Each data section keeps one family hue
 * (export info, backups accent, import xp, wipe danger) so sections are
 * distinguishable before their titles are read.
 */
function CardHeader({
  title,
  soft,
  ink,
}: {
  title: string;
  soft: ThemeColor;
  ink: ThemeColor;
}) {
  const theme = useTheme();
  return (
    <View style={styles.cardHeader}>
      <View style={[styles.cardHeaderMark, { backgroundColor: theme[soft] }]}>
        <Spark size={14} color={theme[ink]} />
      </View>
      <ThemedText type="headline">{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  cardHeaderMark: {
    width: 28,
    height: 28,
    borderRadius: Radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  heroText: {
    flex: 1,
    gap: Spacing.one,
  },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  countCell: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 88,
    alignItems: "center",
    gap: Spacing.half,
    paddingVertical: Spacing.twoHalf,
    borderRadius: Radii.medium,
    borderWidth: HAIRLINE,
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
  textArea: {
    minHeight: 120,
    // Cap growth: a loaded backup is ~20KB of JSON; uncapped, the field
    // grows to full-screen height and buries the Preview/Import buttons
    // below the fold with all touches intercepted (device-verified).
    maxHeight: 240,
    borderWidth: 1,
    borderRadius: Radii.medium,
    padding: Spacing.two,
    textAlignVertical: "top",
  },
  exportBox: {
    gap: Spacing.two,
  },
  exportScroll: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: Radii.medium,
    padding: Spacing.two,
  },
  mono: {
    fontSize: Typography.caption.size,
  },
});
