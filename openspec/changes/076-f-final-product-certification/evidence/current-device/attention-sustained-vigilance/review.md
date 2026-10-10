# Current-device acceptance — `attention-sustained-vigilance`

- Date: 2026-10-10T10:06:17+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-attention-sustained-vigilance`
- ARTEMIS session: `174c9016-6927-43e6-bd7a-4f62f1d9ddbb` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# game_state_review_log — attention-sustained-vigilance (com.braintraining.app)

## 1. Active Play Board
(Verified on live session 2 via screenshot + `uiautomator dump`, ids `attention-sustained-vigilance.*`)
- Header chips: "Trial 22/30" + green progress bar (a11y desc "22 of 30 rounds complete"); "Score 360".
- Visible controls (literal labels): "Pause" (top-right rounded button), "GO" (large red response button).
- Score row: label "Score" (left) / value "360" (right).
- Stimulus: one large dark rounded-square cell containing only a tiny grey center dot — current state "Blank" (a11y desc: "Blank. Keep watching for numbers; hold GO on the stop number 9.").
- Instructions VISIBLE: "Tap GO — hold on 9" directly under the cell (plus "·" dot glyph in the cell row).
- Hierarchy/legibility: clear top-down order (chips → score → stimulus → instruction → GO); white-on-dark text sharp and legible; no overlay; verdict/instruction area distinct from stimulus cell.
- Board auto-advances trials without player input (idle progress observed 19→22 trials).

## 2. Scored Feedback
- EXACT verdict text (timeout reveal, device screenshot at T+16:01, Trial 19/30): **"Missed one"** — shown in yellow above the GO button.
- Accessibility description of the same reveal, verbatim: "Missed, no tap in time. Blank. Stop number 6."
- Context on that screen: chip "Trial 19/30", "Score 240", progress a11y "19 of 30 rounds complete".
- Correct-hit scoring also observed: final rows "Go hits: 1/26" and "Mean reaction: 862 ms" (a tapped GO was scored; idle sessions ended 0/26 with Mean reaction "—").
- Intro screens and unanswered boards were never counted as feedback.

## 3. Pause & Resume
(Opened via "Pause" button [754,262][983,388] during live round; dumped beneath the overlay)
- Overlay headline: "Paused"
- Overlay body: "The challenge is hidden and the timers are frozen."
- Buttons (verbatim, side by side): "Resume" [204,1318][519,1444] | "Quit" [561,1323][876,1449]
- Frozen board visible beneath: chip "Trial 2/30" (a11y "2 of 30 rounds complete"), "Score 0", "Score", instruction "Tap GO — hold on 9", "GO", "Pause" — confirming timers frozen while overlay up.
- Resume: tapped "Resume" → board returned to live play (see heading 5 for tap-registration evidence).

## 4. Final Result Screen
(Verbatim from `uiautomator dump`, screen `attention-sustained-vigilance.results` — this is the FINAL device state of the journey, session 3)
- Headline: "Keep going" (id attention-sustained-vigilance.result-headline)
- Final score: 591
- Go hits: 1/26
- Stop numbers held: 4/4
- Commissions: 0
- Mean reaction: 862 ms
- Best streak: 1
- XP: 25
- Reward: "Reward  +25 XP  ·  +5 coins"
- "Progress saved"
- Buttons: "Play again" (id attention-sustained-vigilance.restart) | "Done" (id attention-sustained-vigilance.quit)
- Reference (earlier sessions this journey): session 1 = headline "Keep training", Score 0, Accuracy 0%, First-try rate 0%, Rounds passed 0/6, Best streak 0, Timeouts 6, XP 10, "Reward  +10 XP  ·  +2 coins", "Progress saved"; session 2 = headline "Keep going", Final score 480, Go hits 0/26, Stop numbers held 4/4, Commissions 0, Mean reaction —, Best streak 1, XP 22.
(Session-1 draft block removed as superseded — its values are preserved in the "Reference (earlier sessions)" line above.)

## 5. Input & Exit
- Tap registration: IMMEDIATE — every tap took effect on first attempt; no retries needed anywhere in the journey. A timed GO response was scored within <1 s (Go hits 1/26, Mean reaction 862 ms, vs 0/26 / "—" in sessions with no taps).
- First-try taps verified: "Done" → Games list; "Signal Watch" list card → detail page; "Play Signal Watch" → intro; "Start game" → live session; "Pause" → overlay; "Resume" → live board; "Play again" → new live session.
- EXIT proof: from the Result screen tapped "Done" → Games list displayed (title "Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", "TRAIN YOUR BRAIN", filters "All, 42" / "Memory, 7" / "Attention, 5" / "Speed, 5" / "Math, 5", search "Search all games").
- RETURN proof: tapped list entry `game-card-attention-sustained-vigilance` (a11y "Signal Watch, Attention game, Developing", [551,1010][1038,1524]) → detail page ("Watch the stream and respond to signals while holding on the stop cue.", "Includes a short guided tutorial on first play.", stats SESSIONS 27 / BEST 77% / AVERAGE 36%, mastery "Developing — Win 2 more Hard rounds to reach Proficient") → "Play Signal Watch" → intro ("Signal Watch" title, chips Easy/Normal/Hard/Expert/Adaptive, buttons "Start game" / "How to play" / "Back to games") → "Start game" → LIVE board. Safe exit and re-open proven.

## 6. Defects
- Low contrast: the "GO" response-button label renders as dark-maroon text on red; in the post-trial reveal state (dark-red button) the label nearly disappears — hardest to read exactly when the next response is required. On the live board (bright red button) it is legible but still weak.
- Otherwise none observed: no clipped text, no overlapping UI, no hidden/unreachable actions (Pause/Resume/Quit/Play again/Done/Start game all reachable), no unresponsive input (all taps registered first try), app never crashed.
- (Tooling note, NOT an app defect: `uiautomator dump` intermittently hit "Segmentation fault" on this build; the game itself stayed responsive throughout.)

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
