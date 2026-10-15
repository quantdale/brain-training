# Data07: independently verified restore journey

ARTEMIS Pro trace `51d82686-3931-4f8e-ba80-6ecac2ce6839` drove the normal
data-management UI on native07/d62bbfc7, emulator-5570. Installed APK
`f1a7d86fcc1920c5d14b9e61684f4a6919a697ca9b068232baadcb4255ac6347`.
The checker was deliberately OFF; operator notes are not an automated PASS.

**Terminal task status: CANCELLED**, stopped by root at3816.6s after all device
checks and final operator notes. The provider rejected finalization with400:
an assistant tool-call message lacked its required tool responses. Doctor still
reported ready5/5; one finalize-only resume instruction made no progress.
There was no repeat device journey. No401 credential repair was needed.
`stderr.log` is absent; stdout contains the serialization error. Automatic
`output.md` was not produced. The operator's factual report remains in external
`notes/campaign077_native07_data_proof.md`; its “ALL PASS” wording is self-report.

## Actual evidence root inspected

| State | Observed evidence |
|---|---|
| Saved backups/export | Full-width filename and wrapped actions; fresh normal input/export `campaign077-native07`. Inline export says8sessions/9ledger entries saved. Backup checksum `21b05da85c108b3a6bd001bef1c1741b788053fc49f14e0c22b9d4daaf560b47`, schema13/120records |
| Merge | Root viewed step38: **“Merge complete: 0 sessions added, 8 skipped, 0 ledger entries added.”** One successful engine application; redundant later tap was intercepted, not counted as a second write |
| Actual text-change invalidation | Root viewed step50's valid Replace8/9 preview and step51's actual `{` TextInput, removed preview and disabled-looking apply. Controller hierarchy confirms `data-import-replace enabled=false` |
| Replace | Root viewed step63: **“Replace complete: current data was erased and 8 sessions restored (0 skipped, 9 ledger entries added).”** Preview consumed. One deliberate successful two-tap write burst; arm-only geometry probes did not apply a restore |
| Restart | Controller force-stop/relaunch; root viewed step67's Ready/8saved sessions and retained backup, and final step69 Home with Level2/186XP/49coins/today0/4 |
| Appearance | Independently preserved settings omit theme, selecting default System. Raw settings hash is unchanged. Subsequent bracketed Home capture records requesteddark/observeddark with APK-bound persisted-preference/Activity evidence; theme is not inferred from screenshot brightness |

Actual images and trace remain external under `D:/Tools/artemis/traces/`.
They are not copied into Git. Root inspected the concrete images, rather than
accepting a consumed preview or unchanged count as proof of a restore write.
Step68 also shows the old native07 Home loading false-zero issue; its source
repair is already in6c/native08 and still needs new-APK qualification.

## Independent SQLite verification

After terminal cancellation and doctor-confirmed idle device, root force-stopped
the app and preserved exact db/wal/shm files. Verification used separate copies;
the originals remain untouched under local `runtime-data07/sqlite-preserved/`.

- Integrity `ok`; all8session rows, IDs, game/generator/scoring versions and
  result/provenance values match the pre-native07-install snapshot.
- Exported ledger/rating-history/XP-award content matches;9ledger entries,
  15history rows, oneXPaward. The49coin sum and186totalXP are unchanged.
- Seven domain ratings,15quest-progress rows,6tutorial-state rows,3workouts,
  2achievement unlocks and remaining definition/favorite data are retained.
- Workout rows remain Oct15 active/index0, Oct14 active/index2 and Oct13
  completed/index4. No new game, skip, reroll or reward claim occurred.
- Settings values and raw SHA-256 are unchanged:
  `a50813e8b2f4cf43007e4974865a96f85f080e8db3b32d006edee347b9cc2ec9`.
- Full-row changes are internal `id` values in currency_ledger/rating_history/
  xp_awards, plus profile.updated_at. The source's actual `serialize.ts`
  RAW_SELECT omits those three autoincrement IDs and `apply.ts` regenerates
  them. All their exported fields match exactly. Profile's other fields match.

The first verifier wrongly required these internal IDs to survive Replace and
failed on currency_ledger. That is an invalid verifier assumption, not a
reproduced currency defect. The corrected comparison follows the actual export
projection and reuses the preserved files; no device data or failed artifact
was overwritten. It does not ignore operation IDs, amounts, reasons, session
links, versions, timestamps or actual exported identity.

Local proof `qa-artifacts/campaign077/runtime-data07/preservation.json`, SHA-256
`fa4ce9538e9e5f2e3b61a01d30ca1564fe8d1f984a973d23eff5704ee16d49f3`.
The successful observed writes, stale-preview invalidation and preservation
are independently qualified. The trace itself remains CANCELLED.

## New confirmed P2: armed confirmation reflow

Actual captured complete native XML gives resting Replace bounds
`[458,2227][845,2353]` and armed bounds `[84,2374][769,2400]`.
The original tap center is outside the armed button. Preview Replace's bounds
remain `[84,1610][456,1736]`, ruling out a whole-page scroll/inset shift as the
cause. The longer label wraps the control onto another action row and leaves
only26px of its armed bounds visible in this viewport.

`python qa-artifacts/campaign077/probe-confirm-reflow.py <before.xml> <armed.xml>`
replays the actual native snapshots and fails on both origin/width stability and
retention of the original tap point. Valid failure is preserved as
`runtime-data07/confirm-reflow-before01.json`; before/armed XML SHA-256 are
`d65179aecae7c2b182ce43b7077282f3274674154889b533f526e9402a9a1498` and
`585eaff0d93b3b39dfc6cd50934759a1a62fce508c393c791b11ea6c9db4afa5`.
The initial probe invocation failed because the earlier verifier had stopped
before copying XML; it is not counted as a valid red regression.

Source correction gives Merge and Replace separate full-width rows and passes
the existing Button fullWidth option through ConfirmButton, defaultfalse for
other consumers. Handler/consent/4s-arm behavior is unchanged. Existing affected
two suites/54tests PASS54.744s; TypeScript and scoped zero-warning lint exit0.
React review finds no new hook/subscription/effect/data-fetching work or changed
accessibility/handler contract. Jest does not perform native Yoga geometry;
the actual XML replay is the regression seam, and new-APK green proof is OPEN.

Native08 remains staged, never installed. Native09 will contain both the Home
availability repair and this confirmation-layout correction. Full corrected
profiles, new bounds proof, current-day offline workout and performance/final
handoff obligations remain open. This data journey did not play an offline game.
