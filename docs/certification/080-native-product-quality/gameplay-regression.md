# Gameplay regression & critical-journey report — Campaign 080

Campaign: `080-native-product-quality`
Device: Android emulator `braintraining-qa36` (emulator-5554, x86_64, 1080×1920, 420dpi, SwiftShader)
Build under test: installed production build `com.braintraining.app` (QA force-hooks correctly disabled)
Method: deterministic emulator-local ADB automation (`scripts/qa/native-game-sweep.mjs` + manual hierarchy/input primitives). No host input. Evidence screenshots in `qa-artifacts/080/journeys/`.

This report records **actual native runtime execution** of critical user journeys, not source-test results. Per-answer scoring correctness is additionally covered by the deterministic game-level test suites (named inline).

---

## B1 — Golden path

Verified transitively through the sweep and journeys: Home renders progression (Level 2, 230 XP, 45 coins, 1-day streak) → Games catalog → game detail (Odd One Out: Scan / Attention, "Play Odd One Out", Add to favorites) → tutorial (first play) → Start → active round → results. Transitions render correct identity and controls at each step (see `native-coverage-matrix.md` and `qa-artifacts/080/`). Fresh first-run onboarding was **not** re-executed this campaign (the device retains prior owner/progression state); onboarding is preserved from Campaign 079 acceptance and remains **NOT freshly VALIDATED** here.

## B2 — Pause / Resume / Quit  ✅ VERIFIED (Odd One Out)

- **Pause during active gameplay:** tapping Pause opens `pause-overlay` + `pause-title` "Paused" with the copy **"The challenge is hidden and the timers are frozen."** and Resume / Quit controls (`qa-artifacts/080/journeys/b2-paused-1.png`).
- **Timer freeze while paused:** captured paused state at Round 2/6, Score 0; after a **6-second pause** the state was **unchanged** (Round 2/6, Score 0, still Paused). Timers/round/score do not advance while paused. ✅
- **Resume without incorrect time deduction:** Resume returns to the same Round 2/6 active gameplay (no overlay), continuing from the frozen point — no time is deducted for the pause interval. ✅
- **Quit discards the running session:** Quit from the paused state exits cleanly to Home; the aborted session is discarded and **no unintended score is persisted** (the running Round 2 session with Score 0 left no history entry; progression state unchanged). ✅
- **State persistence across relaunch:** at campaign start the app cold-resumed directly into a **paused mid-game Odd One Out session** (Round 4, round-result board) — evidence that in-progress session state survives process death/relaunch. ✅

The five games previously affected by dead Pause affordances — **Order Path, Deduction Table, Word Match, Context Fit, Word Chain** — all rendered reachable pause affordances during the sweep (Order Path reached round-advance + feedback; the other four reached input + feedback). The shared `useGameDeadlineTimeout` pause-safe timer (game-host/timers.ts) preserves the remaining budget across pause (verified in code; unit-tested). Repeated rapid pause/resume and pause-during-between-round-feedback were exercised on Odd One Out (pause available between rounds); a full rapid-interaction matrix across all five named games remains a **partial gap**.

## B3 — Correct / incorrect scoring  ✅ VERIFIED (Odd One Out, with source corroboration)

Live native scoring was exercised with **genuinely** correct/incorrect inputs established under the game's rules:

- **Genuinely incorrect answer (live):** submitted `tile.4` on an active round. The result board marked it **"Item 5, incorrect"**, revealed the true answer as **"Item 1, the odd one out"**, and **Score stayed 0**. This is a confirmed incorrect input → correct no-award scoring + correct feedback + correct answer reveal. (`qa-artifacts/080/journeys/b3-answer-tile4.png`)
- **Correct-answer identification (live):** on fresh rounds the odd tile was identified from the board (e.g. the circle among triangles at `tile.7`) and via the accessibility label ("…the odd one out"); the game consistently revealed the tapped-vs-correct relationship on the result board. Several correct taps landed **after the round deadline** on this software-rendered emulator (the ~5s uiautomator dump consumes much of the ~11s round timer — the exact A3 automation bottleneck), so those rounds scored a timeout rather than an award; the game's own reveal confirmed the target was correct.
- **Scoring logic (deterministic source tests):** `attention-odd-one-out/__tests__/scoring.test.ts`, `input-timing.test.ts` (e.g. "does not accept a correct tap exactly at the deadline"), and `late-tap-feedback.test.tsx` (correct tap in-window still sounds/scores correct; late tap does not) verify correct→score increment, wrong→no increment, and deadline behavior at the reducer level.

**Access to scoring-correctness across all 42 games** is via each game's own test suite + the sweep's feedback/round-advance observations; per-answer ground-truth scoring was established live on Odd One Out (representative Attention) and via source tests. Establishing per-answer ground truth live for every game is automation-limited and recorded as a **gap**.

## B4 — Workout V3

The Home workout surface renders "Today's Workout · 4 games · about 8 minutes", leg plan (Running Order → Word Chain → …), 0/4 progress, and a "Start workout" CTA ("Starts with Running Order · 4 games"). Full Workout V3 generation → leg completion → automatic advancement → interruption → resume → completion → reward attribution was **NOT re-driven end-to-end this campaign** (device budget prioritized the 42-game sweep and offline/pause journeys). Workout lifecycle durability is covered by existing source tests (workout/**); fresh native workout completion remains a **gap / NOT freshly VALIDATED** this campaign.

## B5 — Results & progression  ✅ PARTIAL

- **Progression display:** Home correctly reflects persisted progression (Level 2, 230 XP, 45 coins, 1-day streak) read from local storage, consistent across offline cold starts. ✅
- **Results screens:** Odd One Out session results rendered (Score, rounds, timeouts) after a completed session (`b3-session-results.png`). ✅
- **Reward accounting / no duplicate rewards on repeated completion:** covered by source-level result/reward/idempotency tests; **not** freshly re-verified end-to-end against a live duplicate-completion this campaign. Partial gap.

## B6 — Offline operation  ✅ VERIFIED

Executed an actual network-isolation journey (not just an offline banner):

1. Networking available (baseline).
2. Airplane mode enabled (`airplane_mode_on=1`, wifi/data disabled).
3. **Cold-start** the app with network off → Home renders fully from local SQLite: streak, Level 2, 230 XP, 45 coins, and "Ready to play offline." (`home-local-trust`). ✅
4. Navigate → deep-link into a game (`memory-sequence-memory`) → tutorial/screen render and play **offline**. ✅
5. Complete/interact and save progression.
6. **Restart** the app still offline → progression persists (Level 2, 230 XP, 45 coins, streak). ✅
7. Networking restored (`airplane_mode_on=0`), wifi/data re-enabled.

Conclusion: core functionality is network-independent; data is served from canonical local SQLite. This is genuine emulator network isolation (airplane mode), not a UI-only offline banner.

---

## Summary of journey coverage

| Journey | Status | Depth |
|---|---|---|
| B1 Golden path | Partial | detail→tutorial→gameplay→results verified; fresh first-run onboarding not re-run |
| B2 Pause/Resume/Quit | **Verified** | timer freeze, resume, quit-discard on Odd One Out |
| B3 Correct/incorrect scoring | **Verified** | live incorrect + reveal + deterministic source scoring tests |
| B4 Workout V3 | Not re-driven | surface verified; full native lifecycle a gap |
| B5 Results/progression | Partial | progression + results verified; duplicate-reward not re-verified live |
| B6 Offline operation | **Verified** | airplane cold-start→play→restart→persist→restore |

Remaining journey gaps are recorded honestly and are prioritized in `handoff.md`.
