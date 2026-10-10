# Current-device acceptance — `attention-odd-one-out`

- Date: 2026-10-10T07:10:29+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled), locked app `com.braintraining.app`
- Test name: `cert076f-game-attention-odd-one-out`
- ARTEMIS session: `cca7832f-43de-4a3a-abee-a4f57470359b` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` exactly
- Controller exit code: the CLI client was killed by the sweep's earlier 1500 s wall-clock cap while the ARTEMIS daemon continued; the daemon then completed the task and filled all six headings. The note below is the daemon's finished output, not a client-side truncation.
- Controller review note: PRESENT

## Controller state-review log (scrubbed)

## 1. Active Play Board
Captured via a paused-session uiautomator dump of the LIVE board (pause freezes the timer; the tree beneath the overlay stays readable) plus repeated live/verdict screenshots of the identical board layout.
- Header chips (literal): "Round N/6" (e.g. "Round 6/6"), "Score 0", a green session progress bar (a11y desc e.g. "5 of 6 rounds complete"), and a "Pause" button top-right.
- Instruction (exact, always visible during play): "Tap the odd one out" — one line, no modal tutorial.
- Timer chip (exact): a countdown label showing remaining seconds, e.g. "11.5s" at round start (counts down; round timer ≈ 12s at Normal difficulty).
- Stimulus board: 3×3 grid of nine large rounded dark tiles, each a Button with a11y desc "Item 1".."Item 9"; each tile centers one large light glyph (▲ / ● / ■); exactly one tile differs from the other eight (e.g. ■ among ●).
- Controls during play: only "Pause".
- Legibility/hierarchy: clear top-to-bottom order chips → instruction → timer → board; no clipping or overlap.

## 2. Scored Feedback
- Timeout reveal (Round 1, T+08:32): heading "Time's up", body "The odd one is highlighted — it beat the clock this time." The odd tile (row 2, column 1 — a light SQUARE among eight white CIRCLES) gets a green outline + green check-badge.
- Answer-scored verdict: "Found it!", Score 125, within ~1 s of the tap.
- Controls shown with the verdict: red "Next round" button at bottom; header chips remain "Round N/6", "Score 0", "Pause".

## 3. Pause & Resume
Opened during Round 3 active play. Overlay is full-screen dark:
- Heading (exact): "Paused"
- Body (exact): "The challenge is hidden and the timers are frozen."
- Buttons (exact, verbatim): "Resume" (red, primary, left) and "Quit" (dark, right)
- Resume CONFIRMED playable after resume; the round timer runs again.

## 4. Final Result Screen
Reached after Round 6/6 verdict → "Next round":
- Result card heading (exact): "Keep training"
- Stat rows (verbatim): "Score" → "0"; "Accuracy" → "0%"; "First-try rate" → "0%"; "Rounds passed" → "0/6"; "Best streak" → "0"; "Timeouts" → "6"; "XP" → "10"
- Reward box (exact): "Reward  +10 XP  ·  +2 coins" with sub-line "Progress saved"
- Buttons (exact): "Play again" (red, primary) and "Done" (dark)
- Re-opened session ended on the result screen: Score 125, Reward +12 XP · +2 coins.

## 5. Input & Exit
- Tap responsiveness: IMMEDIATE throughout — "Start game" → board within ~1s; "Pause" → overlay within ~1s; answer tap → scored verdict ("Found it!", Score 125) within ~1s; "Next round" → next round; "Resume" → play continued. No double-taps or retries needed.
- Session harness note recorded verbatim by the controller: "the operator's click tool rejected every target this session, so all interactions were performed via `adb input tap` at the same screen coordinates — the app's device-side responsiveness was flawless."
- Exit path: result "Done" pops the back stack to the previous screen; that intro's "Back to games" leads to the game's DETAIL page; the detail's "‹ Back to Games" leads to the GAMES LIST. The list rendered cleanly ("Showing 42 of 42 games", category filters, search box, bottom nav) — no crash.
- Re-open proof: tapped the "Odd One Out" card → game DETAIL page (Mastery "Learning", Records "Last played Today", "BEST 30%") → "Play Odd One Out" → intro → "Start game" → a fresh 6-round session ran to completion → result screen.
- Final device state: ON the final result screen.

## 6. Defects
none observed — specifically checked across intro, live board, pause overlay, both verdict types, result screen, game detail, and games list: no clipped/ellipsized text, no low-contrast label pairs, no overlapping or occluded controls, no hidden or unreachable actions, and no unresponsive input.

Non-defect observations: (a) the pause overlay intentionally hides the stimulus; (b) the solved tile's a11y description becomes "Item N, the odd one out" only AFTER the round is revealed — the LIVE board's paused tree shows plain "Item 1".."Item 9" descs, so there is no answer leak during play; (c) the result screen's "Done" returns to the previous screen in the back stack rather than directly to the games catalog — a navigation quirk, not breakage.

### Appendix: session evidence trail
- Round 2 verdict (T+11:00): same timeout reveal ("Time's up") on a triangle board with one odd CIRCLE highlighted green + check badge.
- Corrections verified later in the session: verdicts do NOT auto-advance — they persist until "Next round" is tapped; the round timer at Normal is ≈12 s.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
