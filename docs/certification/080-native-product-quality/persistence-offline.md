# Persistence, offline & recovery report — Campaign 080

Campaign: `080-native-product-quality`
Device: Android emulator `braintraining-qa36` (emulator-5554, x86_64)
Canonical local store: SQLite (offline-first).
Method: emulator-local ADB automation + existing source-level persistence/portability test suites. Owner/emulator gameplay history was **preserved**, not consumed as disposable test data.

---

## F1 — Safe test isolation / data preservation

- The device retains the owner/accumulated progression state (Level 2, 230 XP,
  45 coins, 1-day streak, prior sessions). This campaign **did not wipe app
  data** and did not use it destructively.
- Native testing was navigation/gameplay driven (deep-link + taps) and any
  session started but quit was **discarded without persisting a score**, so
  accumulated history was not polluted by the sweep.
- State-mutating coverage relied on synthetic, in-session play rather than
  destructive fixtures; no backup/restore of the owner's real data was performed.

## F2 — Persistence verification  ✅ (durability across termination/restart)

Verified through real state transitions (not merely a successful screen):

- **Progression durability:** Level 2 / 230 XP / 45 coins / 1-day streak are read
  from local storage and **persist identically across an airplane-mode cold
  start and restart** (`qa-artifacts/080/journeys/`). ✅
- **Session state survival:** an in-progress Odd One Out session resumed directly
  into its paused Round-4 state after process death/relaunch, demonstrating that
  mid-session state is durably carried. ✅
- **Quit semantics:** quitting a paused running session does **not** persist an
  unintended score; progression state is unchanged. ✅
- **Termination & restart:** covered by the offline restart above. ✅

**Not freshly re-verified this campaign (recorded as gaps):** upgrade-install
with a DB migration over real prior data; workout-leg advancement persistence
end-to-end; quest/reward/rating/analytics row-level transitions compared against
expected values; interruption-recovery mid-transaction. These remain covered by
existing source suites (`db/`, `data-portability/`, `workout/`, `rating/`,
`quests/`) but were **not** re-driven against a live device state this campaign.

## F3 — Backup & restore

Safe export/import (including malformed-backup rejection, duplicate handling,
transactional recovery, and compatibility range) is covered by the
`data-portability` source suites and the large-backup memory probe (see
`performance.md` C5: a 20k-session export produces ~15 M UTF-16 units / 966
chunks with a ~96 MB heap delta — a documented batch-export tradeoff). Fresh
native on-device export→import round-trip against controlled fixtures was **NOT**
executed this campaign — recorded as a **gap / NOT freshly VALIDATED**. Cloud
backup policy and owner-sensitive restore semantics were **not** altered.

## F4 — Offline guarantees  ✅ VERIFIED (see gameplay-regression.md B6)

- Genuine airplane-mode network isolation was applied; the app cold-started,
  navigated, played a game, saved, and restarted **fully offline**, serving all
  data from local SQLite with the "Ready to play offline." trust signal.
- New QA instrumentation and performance work introduced this campaign add **no**
  network dependency; offline guarantees are unweakened. The two new QA scripts
  (`native-game-sweep.mjs`, `merge-coverage.mjs`) run on the host against the
  device and require no app-side connectivity.

---

## Summary

| Area | Status | Notes |
|---|---|---|
| Data preservation | **Preserved** | owner/accumulated history not consumed destructively |
| Session/progression durability | **Verified** | persists across offline cold start + restart |
| Mid-session state survival | **Verified** | paused session resumed after process death |
| Quit without false persistence | **Verified** | aborted session leaves no score |
| Offline operation | **Verified** | airplane cold-start→play→restart→restore |
| Upgrade/install + migration | Gap | source-covered; not re-driven on device this campaign |
| Backup/restore round-trip | Gap | source-covered; not re-driven on device this campaign |
| Interruption/transaction recovery | Gap | source-covered; not re-driven live this campaign |
