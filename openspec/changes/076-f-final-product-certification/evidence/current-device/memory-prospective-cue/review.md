# Current-device acceptance — `memory-prospective-cue`

- Date: 2026-10-11T15:55:05+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-prospective-cue`
- ARTEMIS session: `afbd9870-7cb1-4f75-b125-d92239f1d782` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — com.braintraining.app deep link braintraining://game/memory-prospective-cue
Game identity confirmed via cold deep link: title "Cue Keeper" (Category "Memory"), mechanic text: "Memorize which symbols are your signals, then tap SIGNAL the moment one appears in a fast stream — with no on-screen reminders." Difficulty selector: Easy / Normal (selected) / Hard / Expert / Adaptive. Buttons: "Start game", "How to play", "Back to games".

## 1. Active Play Board
- Header chips: "Round 1/5", progress bar labelled "1 of 5 rounds complete", "Score 0", and a "Pause" button top-right.
- Card: label "Score" with value "0" top-right; instruction line "Watch the stream…" with a dot progress strip (accessible label "Item 2 of 14").
- Stimulus area: single large symbol rendered centrally — observed "green triangle" (▲).
- Controls (visible literal labels): "GO" button (left) and "SIGNAL!" button (right, red).
- Pre-stream watchlist screen: "New signals — tap SIGNAL when you see them:" showing two watchlist symbols: yellow sun ☀ and lime cross ✚; note "Everything else is a GO symbol. The watchlist will not be shown again this round." + "Start stream" button.
- Instructions: yes, visible during play ("Watch the stream…" + watchlist line pre-stream). Board legible with clear hierarchy (dark card, large centered symbol, distinct red SIGNAL! action vs dark GO).

## 2. Scored Feedback
- EXACT timeout reveal text observed: "Timed out. lime cross was a signal. Correct was SIGNAL." (compact UI strings: "Timed out", "✚", "was a signal", "Correct: SIGNAL"). Context: round 1, item 2 of 14 — a lime cross ✚ signal appeared and no SIGNAL tap landed, so the item was scored as a miss while Score stayed 0.

## 3. Pause & Resume
- Pause opened by tapping the "Pause" button (top-right of the play header). Round timer froze as stated.
- Overlay literal text: heading "Paused"; body "The challenge is hidden and the timers are frozen."; buttons: "Resume" (red, primary) and "Quit" (dark, secondary).
- Board chip reads confirmed beneath the overlay: "Round 1/5", "Score 0", timer chip "20.0".
- Resumed via the "Resume" button — overlay dismissed and the stream continued from the same point (item 11 of 14).

## 4. Final Result Screen
- Headline: "Keep training" (no game title on this screen). Decorative header card with a 10-segment progress strip (2 segments filled pink/red) and a small round progress ring.
- Stat lines (literal): "Final score" 0; "Signals caught" 0/10; "Accuracy" 0%; "False alarms" 0; "Rounds passed" 0/5; "Best streak" 0; "XP" 10.
- Reward (literal): "Reward +10 XP · +2 coins" with sub-line "Progress saved".
- Buttons: "Play again" (red, primary) and "Done" (dark, secondary).
- Reached after round 5/5 ("Not quite", "Signals caught 0/2") via the "See results" button.
- Game identity confirmed by UI tree: root container resource-id "memory-prospective-cue.screen" and screen "memory-prospective-cue.results" — deep link resolves to this game's own result screen.

## 5. Input & Exit
- Tap registration: all answer/stream taps that were applied to the intended element registered; the only failures were my own coordinate errors (one tap with a y outside the normalized range at step 7, and one tap aimed above the "Start stream" button at step 19), not app unresponsiveness. GO/SIGNAL controls responded instantly to presses; "Start stream", "Next round", "Pause" and "See results" all advanced on the first valid tap.
- Exit: from the RESULT screen I tapped "Done" (memory-prospective-cue.quit, bounds [382,1984,697,2120]) and landed on the app's "Games" list ("Games" heading, "Pick a game to train a skill…", "Browse all games", filter chips All 42 / Memory 7 / Attention 5 / Speed 5, cards Odd One Out / Signal Watch / Symbol Tracker / Target Count, bottom nav Home / Games / Progress / Profile). No crash, no dialog — clean exit.
- Return: re-fired the deep link (`am start -a android.intent.action.VIEW -d braintraining://game/memory-prospective-cue`) from the Games list; shell output "Starting: Intent { act=android.intent.action.VIEW dat=braintraining://game/... }" / "Warning: Activity not started, intent has been delivered to currently running top-most instance." The app routed straight back to this game's intro: "Remember" / "Memory" eyebrow, title "Cue Keeper", the mechanic text, difficulty Normal, buttons "Start game" / "How to play" / "Back to games". Safe exit AND safe return both proven.

## 6. Defects
- None blocking observed. All controls were reachable and taps registered immediately (GO, SIGNAL!, Start stream, Pause, Resume, Next round, See results, Done, Start game).
- Minor (cosmetic/accessibility only): the round progress bar's accessibility label lagged the visible round chip ("1 of 5 rounds complete" while the chip still read "Round 1/5"); the "Retired — no longer signals:" symbols are rendered small and dim (low-ish contrast) though legible. No clipped/truncated text, no overlapping controls, no hidden or unreachable action, no unresponsive input.
- Section 2 refinement: a second (and then further) timeout reveal occurred after Resume, exact text: "Timed out. sun was a signal. Correct was SIGNAL." (signals are the two watchlist symbols yellow sun / lime cross; any missed signal item in the stream produces this "Timed out" verdict banner with a red/green GO-vs-SIGNAL answer key).
- Section 2 round-1 verdict panel (exact): heading "Not quite" (red) with stat line "Signals caught 0/2"; above it the last item's timeout banner "Timed out — [symbol] was/was not a signal" with GO/SIGNAL answer key; below it a "Next round" button. Round counter stayed "Round 1/5", Score 0 (no points earned this round).
- Section 1 refinement (Round 2 pre-stream card, mechanic is prospective memory): header "Round 2/5" + progress bar labeled "1 of 5 rounds complete" + "Score 0" + "Pause"; card top-right "Score" / "0"; heading "New signals — tap SIGNAL when you see them:" with one symbol (gold star ★); subhead "Retired — no longer signals:" listing lime cross ✚ with a small red ✕; line "1 earlier signal still active — no reminders, keep them in mind."; line "Everything else is a GO symbol. The watchlist will not be shown again this round."; full-width red "Start stream" button. Watchlist mutates each round (new symbols added, old ones retired, others kept active).
- Note: element list carries an a11y line "1 of 5 rounds complete" for the progress bar; the visible chip still reads "Round 1/5" at this instant (label lag) while the card header shows "Round 2/5".
- Section 2 (additional timeout reveal, round 2 start): "Timed out. amber note was not a signal. Correct was GO." (a GO symbol was wrongly awaited/reacted — non-signal item resolved as timeout with answer key GO).
- Section 2 (round 2 verdict panel, exact): heading "Not quite"; stat "Signals caught 0/2"; the round's final item banner "Timed out. red heart was not a signal. Correct was GO." (GO/SIGNAL answer key chips, GO ticked). Round chip "Round 2/5", Score still 0.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
