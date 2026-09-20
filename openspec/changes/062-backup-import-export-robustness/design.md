# Design — 062-backup-import-export-robustness

## Stat fallback (`file-transport.ts`)

```ts
// After the existing asset.size gate:
let statBytes: number | null = null;
try {
  const statSize: unknown = (file as { size?: unknown }).size;
  if (typeof statSize === "number" && Number.isFinite(statSize)) {
    statBytes = statSize;
  }
} catch {
  // A quirky provider bridge must not break picking: fall through to the
  // existing text/deserialize gates.
}
const knownBytes =
  typeof asset.size === "number" && Number.isFinite(asset.size)
    ? asset.size
    : statBytes;
if (knownBytes !== null && knownBytes > MAX_BACKUP_TEXT_LENGTH) {
  throw new MalformedBackupError(
    `Picked backup "${asset.name}" is too large (${knownBytes} bytes; the maximum supported backup size is ${MAX_BACKUP_TEXT_LENGTH} characters).`,
  );
}
```

The cast documents defensiveness (the `File` Blob surface may vary by
provider/bridge). Behavior when neither size exists is byte-identical to
today (text gate → deserialize cap).

Mock: add `get size()` to the test-double File (content length). Tests:
size-absent + over-cap → rejects, `mockTextReads === 0`; size-absent +
small → reads; existing asset-size tests untouched.

## Paste guard (`data-management.tsx`)

```tsx
if (importText.length > MAX_BACKUP_TEXT_LENGTH) {
  setMessage(`That text is too large to preview (limit ${MAX_BACKUP_TEXT_LENGTH} characters). Paste a smaller backup or load it from a file.`);
  return;
}
```

at the top of both `onPreview` and `onImport` (after the busy/empty
guards), plus `maxLength={MAX_BACKUP_TEXT_LENGTH}` on the TextInput.
`MAX_BACKUP_TEXT_LENGTH` joins the existing `@/data-portability`
imports. deserialize's `>` (not `>=`) semantics preserved: equal-to-cap
still previews.

## Copy + backlog

Header caption gains: shared files leave via the share sheet; Android
device backup may carry exported files to a new phone. Update the
`lives only on this phone` test assertion. BACKLOG entry: product choice
whether to exclude `backups/` from cloud auto-backup (restore-semantics
impact — owner decision, not implemented here).

## Deliberately unchanged (evidence in proposal)

Encryption/MAC, cloud exclusion, filename tightening, tmp nonce,
listing filter, export lock, import validation.
