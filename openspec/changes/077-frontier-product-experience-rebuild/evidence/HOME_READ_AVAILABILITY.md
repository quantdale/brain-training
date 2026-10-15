# Home must distinguish unread progress from empty progress

Native06's expanded/light Home and several dark startup images visibly show
loading skeletons beside Level1/0XP,0day streak,100XP to Level2 and a claim that
history will appear after the first workout, despite eight real saved sessions.
Those images remain invalid settled captures, but they also expose a realP2
loading-state problem: empty fallback objects were presented as known progress.
The same fallback appeared after read failure; its retry card was below the
main content and hidden entirely when no games were registered.

Root reproduced the exact real Home caller with a pending XP read and a failed
XP read. Initial fixture lacked workouts.getOrCreate and all four tests failed
with unrelated console errors; that run is not accepted red evidence. After
correcting only that fixture, two exact availability regressions fail and two
genuine empty/existing-profile controls pass (before02,12.38s).

The source now displays engagement numbers, XP-to-next/milestone copy and recent
history only after a successful read. The existing loading skeleton remains.
The existing read-failure/retry card moves to the progress position and also
works without a catalog; its established text/handler are preserved. A new retry
test verifies recovery to actual186XP. Successful empty profiles still show real
Level1/0XP and genuine first-workout copy. Successful existing profiles still
show186XP/Level2/49coins. Workout, progression, storage, scoring, timers and
currency handlers are unchanged.

Validation: four Home suites14 tests PASS24.164s. The strengthened retry and
canaries subsequently pass9/9. Combined current Home/app-shell/canaries six suites
32 tests/five snapshots PASS20.807s, without snapshot update flags. TypeScript
exit0; owned ESLint exit0/zero warnings. Two old canaries failed after the intended
UI correction; only Home and integrated-tabs snapshots change. Games/Profile/
Progress canary blocks are byte-identical. Home's test is accurately renamed
db-unavailable recovery rather than first-run; old-name snapshot removed/new
name written, integrated snapshot updated, five total retained. No failed run is
relabeled; no tests disabled or thresholds relaxed.

Local artifacts `qa-artifacts/campaign077/home-data-availability-*` and
`home-availability-*` retain fixtures/results/logs. Native08/current-source Home
loading/settled visual acceptance and final whole-source certification remain
OPEN. This record does not promote native07 frames to the new source.
