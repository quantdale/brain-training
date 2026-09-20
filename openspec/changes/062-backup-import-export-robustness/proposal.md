# Change 062 — Backup / Import / Export Robustness

**Status:** IN_PROGRESS
**Predecessor:** `061-performance-lifecycle-cleanup` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 062–064 release resilience and platform robustness.

## Problem / evidence

Verified against source at `563435b`:

1. **Picker size gate bypass when providers omit `asset.size` (MEDIUM).**
   `pickBackupFile` (`file-transport.ts:230-238`) gates only on the
   picker-reported size; several providers omit it, so a multi-hundred-MB
   pick reaches `file.text()` and OOMs the JS heap before the deserialize
   cap ever runs. The copied cache file itself is stat-able — unused.
2. **Paste-box unbounded before preview (MEDIUM).** `onPreview`/`onImport`
   feed arbitrary-length pasted text into `previewImport` (parse +
   canonical copy ≈ 3× memory) with no pre-check; the TextInput has no
   `maxLength`. (Native `maxLength` truncates silent pastes to the cap,
   so the JS guard message is reachable via programmatic loads, not
   manual typing — both layers kept.)
3. **"Only on this phone" copy is inaccurate (MEDIUM).** The header
   (`data-management.tsx:414-419`) claims no cloud copy, but exported
   backup files live in the files domain (`Paths.document/backups`),
   which the committed backup rules do NOT exclude (`database` domain
   only, `with-android-backup-rules.js:45-65`) — Android auto-backup
   carries them under the default `allowBackup=true`. Verified by config
   inspection.
4. **Tmp-nonce/filename/listing claims: accepted LOW.** `Math.random`
   nonce lives in the sandboxed private dir (unpredictability buys
   nothing); traversal is blocked (the security property); hiding
   dotfiles would hide user data. No change.

## Desired invariant / outcome

- A hostile/oversized pick is rejected by byte size before any string
  materialization, whether or not the provider reports a size.
- Oversized pastes are refused with an honest message before preview
  parsing; the input box caps natively at the supported maximum.
- The header discloses the real device-copy story; the cloud-exclusion
  product choice is recorded for the owner (not implemented silently —
  it changes restore semantics).
- Restore robustness unchanged: valid backups (incl. skewed-clock and
  retired-game content) still import; traversal stays blocked; no user
  file is ever hidden from listing.

## Non-goals

- No backup encryption/MAC (constitution-deferred).
- No cloud-exclusion config change (owner product decision → BACKLOG).
- No filename-validation tightening (would orphan legacy files).
- No tmp-nonce change (sandboxed; accepted LOW).
- No export-lock/trigger/import-validation changes (proven paths).

## Affected areas

`data-portability/file-transport.ts` (+ mock size getter +
`file-transport.test.ts`), `app/data-management.tsx` (+
`data-management.test.tsx`), `.agent/BACKLOG.md` (product decision).

## Protected contracts

64MB deserialize cap semantics, picker-cancel/share flows, preview
idempotency, import validation, offline, console baseline, no-medical
claims in copy.

## Implementation plan

1. `pickBackupFile`: after the asset-size gate, stat the copied file
   (`file.size`, defensive try/catch + finite check) and reject past the
   cap with the same `MalformedBackupError` shape. Mock: `size` getter
   (content byte length); tests: size-absent + huge file → rejects with
   zero `text()` reads; size-absent + small file → reads normally.
2. Paste guard: `if (importText.length > MAX_BACKUP_TEXT_LENGTH)` refuse
   with message before `previewImport` in both `onPreview` and
   `onImport`; `maxLength={MAX_BACKUP_TEXT_LENGTH}` on the input.
   Tests: oversized paste → preview never called + message; suite green
   (programmatic values bypass native maxLength).
3. Copy: header gains the share-sheet + device-backup sentence; update
   the `/lives only on this phone/i` assertion honestly; BACKLOG entry
   for the cloud-exclusion product choice.
4. Full matrix + adversarial review + close.

## Test plan

- New transport tests (stat fallback both directions, zero-read proof).
- New/updated data-management tests (paste guard, maxLength prop,
  header copy).
- Full gated Jest + console gate + typecheck + lint + validators +
  OpenSpec strict.

## Runtime/native evidence plan

No UI-layout/route change (copy + guards only): repository gates are the
evidence. The size gate is unit-pinned (device SAF variance stays a
062-noted boundary, re-proven at 067 certification).

## Rollback / risk notes

- Stat fallback is additive (asset-size gate first, unchanged); a
  `file.size` quirk falls through to current behavior via try/catch.
- `maxLength` equal to the cap keeps every currently-valid paste valid.
- Copy change is text-only.

## Completion criteria

Standard terminal bar + per-item tests + full matrix exact counts +
adversarial review + pushed + `HEAD == origin/main`.
