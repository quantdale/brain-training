# Campaign 043 — Android System UI Boundaries

Status: `PASS` for the reachable emulator-local Android system surfaces.

## Share sheet

1. On the release APK, Data Management exported a versioned JSON backup to the
   app-private backups directory.
2. The fresh export's Share action opened package
   `com.android.intentresolver`.
3. The hierarchy showed `Sharing 1 file`, the exported JSON filename, and
   visible destinations including Quick Share, Drive, and Gmail.
4. The sheet was cancelled with an emulator-local Back event; control returned
   to `com.braintraining.app`.

Evidence is captured outside Git at:

- `D:\Temp\campaign043-runtime\share-sheet.xml`
- `D:\Temp\campaign043-runtime\share-sheet.png`

No external destination was selected and no message or upload was sent.

## Document picker

1. Data Management's Load from file action opened
   `com.google.android.documentsui/com.android.documentsui.picker.PickActivity`.
2. The real DocumentsUI frame showed Recent files, Images/Audio/Videos/
   Documents filters, and local XML fixtures.
3. No file was selected. The picker was cancelled with an emulator-local Back
   event and the app regained focus.

Evidence is captured outside Git at:

- `D:\Temp\campaign043-runtime\document-picker-current.xml`
- `D:\Temp\campaign043-runtime\document-picker-current.png`

No import, replace, wipe, or destructive data-management operation was
performed. The system-sheet result proves reachability and return behavior only;
it does not substitute for human file-provider and sharing usability review.
