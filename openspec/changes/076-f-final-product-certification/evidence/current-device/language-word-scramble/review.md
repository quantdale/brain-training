# Current-device acceptance — `language-word-scramble`

- Date: 2026-10-11T14:14:14+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-language-word-scramble`
- ARTEMIS session: `a533c988-b098-4819-a428-7ed491991c09` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# game_state_review_log — language-word-scramble (com.braintraining.app), Normal difficulty

## 1. Active Play Board
Entered via "Start game" on the intro screen. Layout on the play board:
- Top status bar box: "Round 1/5" (text) + horizontal round progress bar (green fill segment) + right-aligned "Pause" button.
- Second chip line: "Score 0".
- Board card: "Score 0", hint line "Hint: Professions", large scrambled stimulus letters "W E L Y A R" (letter tiles), sub-instruction "Unscramble the letters".
- Answer controls (2x2 grid of buttons): "parsley", "archery", "valley", "lawyer".
- Action control: full-width "Submit" button (rendered desaturated/disabled-looking until a choice is made).
- Instructions ARE visible ("Unscramble the letters" + "Hint: Professions").
- Legibility: high contrast, clear hierarchy (round/score chips at top, stimulus centred, options below, Submit at bottom).

## 2. Scored Feedback
Round 1 answer submitted: selected "lawyer" -> tapped "Submit".
EXACT verdict text: "Correct!" (large green text at top of the board card).
Score chip updated: "Score 160" (top bar) / "Score 160" in board.
Explanation block (green): `Answer: lawyer` and `"welyar" unscrambles to "lawyer"`.
Chosen option "lawyer" highlighted green with a checkmark; other options dimmed.
CTA changed from "Submit" to "Next round".


## 3. Pause & Resume
Tapped the "Pause" button (top-right of the round header) during Round 2 -> PAUSE overlay opened.
Overlay contents (verbatim):
- Title: "Paused"
- Subtitle: "The challenge is hidden and the timers are frozen."
- Buttons: "Resume" (primary, red) and "Quit" (secondary, dark)
Overlay is a full-screen scrim (resource-id `language-word-scramble.pause-overlay`, e.g. `language-word-scramble.resume`, `language-word-scramble.quit`); the board behind is hidden (challenge hidden) and the round timer is frozen.
Under the frozen overlay the underlying Round 2 board read: Round 2/5, Score 160, progress content-desc "2 of 5 rounds complete", "Hint: Music & Sound", scrambled "UUFGE", options fugue/flute/oxygen/turret, Submit (disabled).



## 4. Final Result Screen
Reached after all 5 rounds (Round 5 answered correctly, then CTA "See results" tapped). Screen contents:
- Reward/grade banner (top card): medal badge graphic with the app's "brain" logo and the word **"Outstanding"** as the large heading.
- Stat lines (label : value):
  - Final score: 780
  - Accuracy: 100%
  - Rounds passed: 5/5
  - Best streak: 5
  - Longest word: 6
  - XP: 50
- Reward banner (green block that appears on the result screen): heading **"Reward  +50 XP  ·  +10 coins"** with sub-line **"Progress saved"**.
- Buttons: "Play again" (red/primary) and "Done" (dark/secondary).
Note: per-round score timeline: R1 160, R2 310, R3 470, R4 620, R5 780 (each correct round +150/+160); all 5 rounds answered correctly with zero wrong answers.


## 5. Input & Exit
- Input registration: taps registered **immediately and on the first attempt** throughout the play phase. Each round's option tap followed by "Submit" produced the scored verdict on the very next frame (R1-R5); "Next round", "See results" and "Done" each advanced the flow on a single tap. No dead taps, no lag, no double-tap needed.
- One intercepted tap was a targeting artefact, not an input defect: the Round-1 burst reused coordinates captured from the intro screen and landed on the neighbouring option "valley"; after re-targeting the correct element the tap registered at once.
- Exit: tapped **"Done"** on the RESULT screen -> the app left the game and landed on the **Games list** (header "TRAIN YOUR BRAIN" / "Games", sub-text "Pick a game to train a skill. New games appear here as they are added.", search "Search games...", "Browse all games", filter "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games", bottom nav Home / Games / Progress / Profile). Safe exit confirmed - no crash, no freeze, no back-stack trap.
- Re-open: fired the deep link `braintraining://game/language-word-scramble` again -> the running instance accepted the intent and returned straight to **this game's own intro page** (title "Word Scramble", category "Language", badge "Unscramble", description "Unscramble the letters to form the correct word using the category hint.", difficulty Easy/Normal/Hard/Expert/Adaptive with **Normal** selected, buttons "Start game" / "How to play" / "Back to games"). Return verified.
- Post-re-open replay (2nd full pass, 5/5 correct): R1 Emotions & Traits LYLOA->"loyal" ("Correct!", 150) / R2 Tools & Objects OAEBNC->"beacon" ("Correct!", 310) / R3 Music & Sound TNSAOA->"sonata" ("Correct!", 470) / R4 Animals OSBIN->"bison" ("Correct!", 620) / R5 Nature STNUSE->"sunset" ("Correct!", 780). Tapping "See results" landed on a **fresh RESULT screen identical to Section 4**, ending the session on the RESULT screen as required.

## 6. Defects
- **Transient layout shift on the RESULT screen (minor)**: the green reward banner ("Reward  +50 XP  ·  +10 coins" over "Progress saved") animates in a moment AFTER the page first renders and pushes the "Play again"/"Done" row downward, so a tap using the pre-banner coordinates is refused (one intercepted attempt) and the element-tree bounds briefly lag the visual position. Self-corrects once the banner settles.
- **No numeric countdown timer chip observed**: in every captured frame of the round header the only timing affordance was the progress bar; no readable numeric timer value was exposed (the pause overlay's text "the timers are frozen" confirms timers exist, but no countdown value is displayed to the player).
- No clipped text observed - all labels, options, verdict text and stat lines render fully.
- No low-contrast text observed - light text on near-black surfaces, red primary buttons and green verdict text are all clearly legible.
- No hidden or unreachable action observed - Pause, Resume, Quit, Submit, Next round, See results, Play again and Done were all reachable.
- No genuine UI overlap observed (the games-list "possible occlusion" warnings were heuristic card-container/text overlaps only).
- No unresponsive input observed.


## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
