# Campaign 054 — System Provider / Import Closure

**Status:** technical path `CLOSED_VERIFIED`; human usability remains
`MANUAL_PLATFORM_PENDING`.
**Date:** 2026-09-19
**Artifact:** exact final release APK (SHA-256
`1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`) on
`emulator-5554` (`braintraining-ui35`, Android 15 / API 35,
`sdk_gphone64_x86_64`; system DocumentsUI picker; emulator-local ADB only).

## Original observation (Campaign 050)

> "Import reached the Android Files picker, but the provider presented an ANR
> during dismissal; no file was selected and no merge/replace/wipe was
> executed. Import picker usability is therefore NOT VALIDATED."

No app-side intent/configuration defect was identified then; the provider
presented the ANR during dismissal.

## Campaign 054 re-test

### Phase 1 — open and cancel (2 cycles, one with pre-scroll)

| Step | Result |
| --- | --- |
| Launch → Profile → Data Management | reached (`data-management-title`) |
| Tap `Import from file` | `com.google.android.documentsui/com.android.documentsui.picker.PickActivity` focused; categories Images / Audio / Videos / Documents / Recent files rendered |
| ANR probes (window/activity/process) during picker open | 0 dialogs, 0 ANR process lines |
| Logcat during picker open | no FATAL/ANR/SQLite/React markers |
| Back (dismiss) | focus returned to `com.braintraining.app/.MainActivity`; app responsive |
| Logcat during dismissal | no markers |

### Phase 2 — full selection, preview, merge (disposable data)

| Step | Result |
| --- | --- |
| Export (`data-export-button`) | durable backup written: `brain-training-backup_2026-09-19_13-50-53.json` (14.07 kB, app `files/backups/`) |
| Disposable copies pushed to `/sdcard/Download/` via root adb | `c054-import.json`, `c054-import-copy.json`, plus `c054-malformed.txt` |
| Import from file | picker opened; drawer → **Downloads**; all three files listed ("Files in Downloads") |
| Select `c054-import.json` | returned to app (`returnedToApp: true`); filename loaded into the import box |
| Preview Merge | **"Preview (merge): Valid — Would add 0 sessions and 0 ledger entries."** |
| Merge Import applied (idempotent against the just-exported identical backup) | accepted; 0 additions; no error; no markers |
| Logcat across selection/preview/merge | no FATAL/ANR/SQLite/React markers |

### Phase 3 — malformed file validation

| Step | Result |
| --- | --- |
| Select `c054-malformed.txt` (plain text) through the same picker | returned to app; text loaded into the import box |
| Preview Merge | **"Preview (merge): Invalid (malformed)" / "Backup is not valid JSON." / "• Import rejected: Backup is not valid JSON."** |
| Logcat | no markers; no crash; app remained responsive |

### ANR scan

Across all phases: 0 ANR dialogs, 0 ANR process lines, and no
`ANR in`/`FATAL EXCEPTION`/`SIGSEGV`/`OOM`/`SQLite-fatal` logcat entries.
The Campaign 050 provider ANR was **not reproduced** in any of the
open/cancel/select/preview/merge/malformed cycles.

## Classification

- App-side invocation: **verified correct** — the app uses the standard
  system document-picker contract (`ACTION_OPEN_DOCUMENT` PickActivity) and
  handles selection, cancel, valid preview, applied merge, and malformed
  rejection without error.
- Provider-side behavior: the system DocumentsUI performed all operations
  normally on this runtime; the historical provider ANR remains a bounded,
  non-reproduced observation (same campaign family as the 050/051
  degraded-AVD observations; Campaign 051's AVD required a clean-boot
  recovery, and Campaign 054 re-tested on a freshly cold-booted AVD).
- Human judgment of the system Files UI (layout, usability, consent sheets)
  remains `MANUAL_PLATFORM_PENDING`; no human-quality claim is made.

## Disposition

`CLOSED_VERIFIED` for the repository-owned technical path (export → picker →
select → preview → merge → malformed rejection), with human/provider usability
retained as `MANUAL_PLATFORM_PENDING`.

Raw artifacts: `D:\Temp\campaign054\runtime\provider-import-results-v2.json`,
`provider-import-results-v3.json`, `malformed-import-results.json`.
