# Spec — backup-import-export-robustness

## ADDED Requirements

### Requirement: Picker rejects oversized files with or without reported size

`pickBackupFile` SHALL reject a picked file whose known byte size
exceeds `MAX_BACKUP_TEXT_LENGTH` before calling `text()`, using the
picker-reported size when present and the copied file's own stat size
otherwise. Rejection SHALL be a `MalformedBackupError` and SHALL NOT
read the file body. (Bytes-vs-chars: the byte gate is conservative — a
chars-valid/bytes-over backup stays importable via paste or internal
Load, which count characters.)

#### Scenario: Size-absent hostile file rejected unread

- GIVEN a picker asset with no `size` whose file holds more than the cap
- WHEN picking
- THEN it rejects with a too-large error and `text()` is never called.

#### Scenario: Size-absent small file reads normally

- GIVEN a picker asset with no `size` whose file is within the cap
- WHEN picking
- THEN the file text returns normally.

### Requirement: Paste box refuses oversized input before preview

Preview and import handlers SHALL refuse pasted text longer than
`MAX_BACKUP_TEXT_LENGTH` with an honest message before invoking
`previewImport`. The input SHALL cap natively at the same maximum.

#### Scenario: Oversized paste refused without parsing

- GIVEN import text longer than the cap
- WHEN previewing or importing
- THEN a too-large message shows and `previewImport` is never called.

### Requirement: Device-copy disclosure is accurate

The Data Management header SHALL state that history lives in the app on
the phone with no account copy, that shared/exported files leave through
the share sheet, and that Android's own device backup may carry exported
files to a new phone.

#### Scenario: Accurate copy

- GIVEN the Data Management screen
- WHEN rendered
- THEN the header carries the share/device-backup disclosure (no
  "no cloud copy" absolute).

## MODIFIED Requirements

None. All changes are additive guards and copy.

## REMOVED Requirements

None.
