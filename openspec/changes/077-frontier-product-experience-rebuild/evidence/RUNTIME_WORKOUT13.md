# Native13 — saved offline workout completion

Application source is `2cdb9ed632cecae6e888fa4a2e7f9fe639f715d5`, installed APK
`797d0309a5204c0ba77df18a3c15a63c61ef1491decd918df9045e8edc553dd6` on
`braintraining-ui35` / `emulator-5570`. This continuation preserves the two
native12 legs in [RUNTIME_WORKOUT12.md](RUNTIME_WORKOUT12.md); it does not replay
or relabel them as native13 gameplay. The device calendar is Oct16 although the
later root verification occurs Oct17 in the host's Philippines timezone.

Pro task `4300edb1-f7be-4c98-8b8e-4cecf2df2fe1` is terminal **COMPLETED**, 11743.6s.
Its final checker has **seven INCONCLUSIVE** results and no automatic passes.
The terminal stdout records another provider HTTP400 tool-history error during
finalization; the announced `stderr.log` and `notes/output.md` do not exist.
Actual notes are `network_log.md`, `leg3_sequence_memory.md`,
`leg4_running_order.md`, `task_plan.md` and `final_report.md`; the latter contains
an initial blank template followed by the filled report. Root does not treat
the terminal status, plan checkmarks or report prose as proof by themselves.
External traces remain external and are not committed.

The initial actual Home is 263XP/64coins, four-day streak, two of four complete,
with Number Line and Transform Match Done and Sequence Memory next. The task
records Wi-Fi2/mobile1/airplane0 before, then disables Wi-Fi and mobile data
through device-local controls and observes no active default network. Both
remaining games and the successful saved-state restart occur offline. It later
restores Wi-Fi2/mobile1/airplane0 and scan-always0, including correcting the
Wi-Fi setting's intermediate1 back to its original2. No clocks, persistence,
fixtures, forced outcomes, app source or APK were changed by the journey.

| Leg | Build actually played | Saved outcome | Reward |
| --- | --- | --- | --- |
| Number Line, index0 | native12 | 150, normalized0.055; one contaminated hit | 12XP / 2coins |
| Transform Match, index1 | native12 | 300, 75% accuracy, normalized0.525 | 25XP / 5coins |
| Sequence Memory, index2 | native13 | Ordinary60s timeout, score0, 0/1 sequences, normalized0 | 8XP / 1coin |
| Running Order, index3 | native13 | 220, 1/4 rounds, 25% accuracy, normalized0.208333; UI21% | 15XP / 3coins |

The new Sequence Memory first-play tutorial reaches the ordinary Got it and
Start path. The live reveal is missed; no answer is entered and the session
ends by ordinary timeout. Actual step20 original
`0a4d0430d99c62fb8e16b5417916b32a7c7377e0cea6c73f3ef4aecd9b61be61.jpg`
shows Time's up,0%,+8XP/+1coin,Progress saved and Running Order Game4of4.
This qualifies timeout/result/continuation, not successful sequence recall.

Running Order's tutorial also reaches ordinary Got it/Start. Recorded raw-frame
sampling has cadence/aliasing limitations: R1 is reported as observed spade/circle
and accepted; R2 includes two guesses and a reportedly observed final symbol;
R3's claimed last-symbol timing is contradicted by the later target and cannot
qualify reliable stream recall; R4 uses observed triangle plus two guesses.
Root does not certify every reported stream inference. Actual R4 feedback shows
220 and two of three recalled, with green checks and a red X. The extra heart
under the wrong submitted square is the intentional correct-symbol replacement
inside that slot, not a fourth submitted answer. Independent source/image review
confirms this distinction.

Actual step57 original
`b4b5e38cf88d6517f2c2018cc43f41a2b52ce225a882ab092b2ebec275390a6e.jpg`
shows the opaque Pause overlay and only Pause/Resume/Quit copy. The recorded
ordinary Resume returns to Round2 with three empty slots before answering.
Root personally viewed the opaque original; this is not a root-captured native
XML bracket for that paused moment or a timer-precision proof. The earlier
Number Line unavailable paused-tree cue remains disqualified for clean play;
all its actual session/reward records are retained honestly.

Actual completed Results original
`a0d0117640416ba5eef13d3c58022c2e0305fccc56721c50a7e952f7464d7914.jpg`
shows score220/25%accuracy,21%session,+15XP/+3coins,Progress saved and the saved
4/4 Workout complete card with normal Finish workout. Root personally viewed
normal completed Home and post-relaunch original
`33fa85f9ad3df1d3c7d8913c63b397d5ddd3d410d2aa0419d5fd745aa9638837.jpg`:
286XP,68coins,four days,all four Done. The first cold restart **ANR'd** and was
system-closed; a second launch recovered this same state. That is persistence
recovery evidence, not reliable/fast cold-start acceptance.

After the task was terminal, root independently captured Home with matching
compressed XML→PNG→XML, MainActivity focus and the exact installed APK. It
personally viewed the actual PNG, showing the same completed state. Separate
exact SQLite db/wal/shm captures were retained; queries used fresh copies only.
The after-workout-4 verification reports integrityok,13sessions,14ledger rows,
four played/zero skipped,completed/index4 and the unchanged four-game plan.
All original nine sessions and the earlier eleven session rows are unchanged.
Four new non-forced session records have matching workout leg provenance and
version metadata. Each has one unique `gameplay:<sessionId>` ledger effect and
XP/currency matching the current pipeline formula. XP-awards/settings/profile
identity and older workouts are preserved. Totals independently sum to286/68.

The initial helper did not directly assert original9→checkpoint11 ledger rows
or original older-workout rows; it asserted current→checkpoint11. Independent
immutable read-only review closes that actual evidence gap: original10 ledger
rows match both later snapshots, prior12 match current14, and all three older
workouts match throughout. All nine preserved db/wal/shm hashes and all13 current
table hashes were independently checked. This supplemental proof is explicit;
the original verification was not silently overwritten or weakened.

| Ignored evidence under `qa-artifacts/campaign077/` | SHA256 |
| --- | --- |
| native-preview13/after-workout-4/verification.json | f3ae6b3221cc2c375f2e47f7c95ae4adc5c228f2ba3833bee7cd7a0e9d21fe1c |
| native-preview13/progress-disclosure-diagnostic/completed-workout-home/screen.png | 4da94349ffbd4528e8a9b4a1a509cf3091f0fdbe14968bfa34067196194bbe22 |
| same capture before.xml and after.xml | 16bc58128cd707a6c8f6a5a6db6754740a466937c19826a72e4ba9ceaf878652 |
| workout13-independent-review.json | f301a35564a7e6ea99062b1d6583b7aedb21e61194452dd320f8e1a0fd7066f2 |

The subsequent final visual-matrix attempt fails its first compact Home when
SQLite connection PRAGMAs report disk I/O errors. Root observes Android storage
98%used/138MiB free and system SQLiteFullException/ENOSPC, while terminal-task raw
frame directories occupy several GiB. This new recovery work remains separate
from the preserved completed-workout proof. Do not claim final visual/runtime,
cold-start, native Button geometry, compact2x tutorials, motion/performance or
visible owner handoff acceptance from this saved-workout milestone.
