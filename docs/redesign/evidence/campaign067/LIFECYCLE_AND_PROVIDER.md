# Campaign 067 — provider lifecycle

**Export + share sheet (PASS).**

1. Data Management → "Export to JSON": export completed and a "Share…"
   action appeared (backup file created in the app backups folder).
2. "Share…" opened the system chooser — `mCurrentFocus =
   com.android.intentresolver/…ChooserActivityLauncher` — proving the
   platform share sheet opened.
3. `KEYCODE_BACK` cancelled: the app returned to Data Management with
   the data intact; zero ANR/FATAL.

**Import picker open/cancel (PASS).**

1. "Load from file…" opened the system Files picker —
   `mCurrentFocus = com.google.android.documentsui/…pick.PickActivity`.
2. The picker was cancelled and the app returned to Data Management;
   zero ANR/FATAL.

**Import apply (NOT VALIDATED — two-tap contract).**

The Files picker successfully delivered and validated a crafted backup
("Preview (replace): Valid"). The shell taps did not apply it because
"Replace Import" is a two-tap `ConfirmButton`: the first tap arms the
button (4-second window) and the second confirms; the shell sequence
tapped once (and on retry did not re-arm within the window). This is a
deliberate destructive-action guard, not a dead control. The underlying
path is covered by:

- `apps/mobile/src/data-portability/__tests__/replace-import-progression.test.ts`
  (crafted envelope with a matching fingerprint + empty catalogs →
  bootstrap reaches ready, catalogs restored, no FK error);
- `apps/mobile/src/app/__tests__/data-management.test.tsx` (arm/confirm
  semantics);
- the 065 device probe (`DEVICE_065.md`): the hostile state was injected
  directly into the device DB and the shipped app cold-launched **Home**
  with catalogs re-seeded, 0 FK violations.

A human/ARTEMIS two-tap journey on a release artifact remains the
closure step (recorded).
