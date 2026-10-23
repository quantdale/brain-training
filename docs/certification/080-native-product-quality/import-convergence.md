# Product data portability convergence — 2026-10-23

**Native product Import action: EXECUTED and reconciled.** This supersedes the
previous automation-limited action gap, not the preserved failed attempts.

## Qualified journey

Dedicated disposable QA profile only, emulator-5554, installed production-mode
APK `15fe8db35441678a74ea8a9a510058224197b86bde8564ed58bff60882c008cc`
(0.1.0/1000). No app implementation change was needed to execute Import.
The corrected driver uses explicit serial and QA-profile consent, verified
pre-mutation full app-data anchor, current hierarchy bounds excluding system
bars, actual product preview, observed Replace arm, second confirmation tap,
completion status, SQLite integrity and canonical logical-row comparisons.

`qa-artifacts/080/final-convergence/import-native-attempt-09.json`:
**10/10 steps observed**, process exit 0:

- Product export: envelope/manifest and eight section/database count agreements.
- Replace: actual `Replace complete` status; 49 sessions / 49 ledger entries
  restored. All 14 measured relations retain matching logical row digests,
  counts and aggregates.
- Merge twice: actual completion for each, no extra rows/rewards/balance.
- Malformed, truncated, unsupported-version, invalid-value backups: each visibly
  rejected at the expected validation boundary; exact database row digests
  unchanged around each rejection.
- Restart: all measured portable row digests, counts and aggregates unchanged.
- Session XP 815; ledger sum and balance 158; 49 sessions, 49 currency rows.

Logical projection intentionally excludes regenerated autoincrement IDs from
currency ledger/rating history/XP awards, profile.updated_at and the refreshable
progression-seed fingerprint. These are not backup identity; all other measured
fields are retained. Exact row digests are used for rejection non-mutation.
This is not merely equality between two empty profiles: the driver refuses
unseeded/empty data as a substantive round-trip baseline.

## Wipe and real product recovery

Full journey `2026-10-23T14-31-02-414Z` repeated Replace, Merge twice and all four
invalid-backup checks. Wipe executed but the UI-message assertion did not
observe its status after the scroll layout contracted. This attempt remains
FAILED, not retroactively relabeled PASS.

Independent stopped SQLite capture
`qa-artifacts/080/final-convergence/sqlite-after-wipe-attempt/` established
integrity `ok`, **0 sessions and balance 0**. Saved backup files remained.
The exported backup `brain-training-backup_2026-10-23_14-31-19.json` and that
journey's substantive baseline were then used for an explicit recovery-only
journey through the real Load → Preview Replace → arm → confirm path.

`qa-artifacts/080/final-convergence/product-wipe-recovery-12.json`:
**product recovery verified=true**, process exit 0. Product completion observed;
all logical row digests/counts/aggregates match the pre-wipe baseline. Restart
retains the same state. This closes actual product restoration from the wiped
profile; the failed wipe-message assertion stays an automation finding. No
raw app-data-anchor restoration was used for this recovery.

## Reproduced harness causes and fixes

- Replace requires two distinct taps under the existing four-second arm.
- Android API 36 uses `Frames: ... frame=` rather than legacy `mFrame=`;
  visible status/navigation bars must be subtracted from edge-to-edge frames.
- GNU tar mistakes a Windows drive colon for a remote host; list the anchor
  basename under an explicit cwd instead.
- Fully top-clipped RN nodes can have `[y=63][bottom<63]` bounds while visible
  targets remain correct. They cannot be tapped; their existence alone is not
  evidence the whole visible layout is corrupt. In-window inversion still fails.
- Center swipes were consumed by the multiline backup TextInput. Gutter swipes
  move the outer page without touching unrelated controls.
- Compressed UIAutomator XML flattens status TextViews outside the empty
  `data-message` container. Read actual app-owned completion text; do not
  mistake an empty container for absent product feedback.
- Re-entering the screen before selecting a new saved file avoids searching
  downward for a file several screens above the previous import action.
- Fresh hierarchy acquisition can exit 0 without creating XML while settling.
  Every failed acquisition is preserved; bounded observation polling never
  repeats input or reuses an old XML file. Failed attempts are not passes.

Driver regression suite covers these data/confirmation/safety invariants.
Source engine rollback/retry/idempotency and screen tests passed (93 focused
Jest assertions at the imported worker checkpoint). Final integrated gates
remain separate. Native process-kill DURING an import transaction and live
prior-release upgrade/migration were not executed here; existing engine and
migration fixtures do not become native acceptance by inference.
