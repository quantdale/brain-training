# Current-device acceptance — `flexibility-card-sort`

- Date: 2026-10-11T18:28:58+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-flexibility-card-sort`
- ARTEMIS session: `65dd90ba-fcec-4235-8bfd-30aecc4b2996` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — flexibility-card-sort ("Card Sort" / Flexibility)
Device app: com.braintraining.app | deep link braintraining://game/flexibility-card-sort | cold-started (force-stop then VIEW intent)
IDENTITY CONFIRMED (cold start): root id `flexibility-card-sort.screen`; game-title "Card Sort"; game-category "Flexibility"; game-description "Match cards by the active rule — the rule keeps switching, so stay flexible."; difficulty radios Easy/Normal/Hard/Expert/Adaptive (Normal selected/checked); intro block "How to play" + buttons "Back to games", "Try a demo", "Start game".

## 1. Active Play Board
INTRO screen (verified, id flexibility-card-sort.intro): title "Card Sort", category "Flexibility", desc "Match cards by the active rule — the rule keeps switching, so stay flexible."; difficulty radios Easy / Normal / Hard / Expert / Adaptive (Normal selected); "How to play" card; buttons "Back to games", "Try a demo", "Start game".
DEMO BOARD (reached via "Try a demo", id flexibility-card-sort.tutorial): heading "Demo"; rule banner chip inside board (id flexibility-card-sort.rule-banner-text); target card; four option tiles each with literal symbol+colour label. No round/score/timer chips are shown on the demo board.
 Demo step 1: status "Match the target by color first."; banner "Match by COLOR"; target = green square ("green"); options = blue square "blue", green circle "green", red square "red", blue circle "blue".
 Tutorial notice overlay: "Rule switched!" / "Match by SHAPE" / "In the real game a short notice like this appears whenever the rule changes." / button "Got it".
 Demo step 2: status "The rule switched — now match by shape."; banner "Match by SHAPE"; target = green circle ("green"); options = blue square "blue", green square "green", blue triangle "blue", blue circle "blue".
REAL SCORED PLAY BOARD (Round 1/10): header chips "Round 1/10" + "Score 0" with a 10-segment progress strip; button "Pause"; in-board rule banner "Match by SHAPE"; target card = red square labelled "red"; instruction line "Pick the matching card"; second "Score 0" chip; 2x2 grid of option cards: red circle "red", green circle "green", blue square "blue", red triangle "red". Instructions ARE visible ("Pick the matching card"); no numeric countdown chip — round progress is the segmented bar; layout legible with clear hierarchy.

## 2. Scored Feedback
Round 1 (rule "Match by SHAPE", target red square "red"): verdict "Correct!" with sub-line "Matched by shape: red square"; chosen tile outlined green with a green check badge; header score chip "Score 0" → "Score 100"; a "Next round" button appeared.
Round 2 (rule "Match by SHAPE", target green circle "green"): verdict "Correct!" with sub-line "Matched by shape: green circle"; chosen tile (red circle) outlined green with a green check badge; "Score 100" → "Score 200"; "Next round" button shown again.
Round 3 (rule "Match by SHAPE", target green square "green"): verdict "Not quite" with sub-line "The match was blue square — matched by shape."; chosen tile (green triangle) outlined red with a red X badge, correct tile (blue square) highlighted green; "Score 200" unchanged; "Next round" button shown.
Round 4 (rule "Match by COLOR", target blue square "blue"): verdict "Correct!" with sub-line "Matched by color: blue square"; chosen blue circle tile outlined green with a green check badge; header "Score 200" → "Score 300"; "Next round" button shown.
Round 5 (rule "Match by COLOR", target green triangle "green"): verdict "Correct!" with sub-line "Matched by color: green triangle"; chosen green circle tile outlined green with a green check badge; header "Score 300" → "Score 400"; "Next round" button shown.
Round 6 (rule "Match by COLOR", target blue circle "blue"): verdict "Correct!" with sub-line "Matched by color: blue circle"; chosen blue triangle tile outlined green with a green check badge; header "Score 400" → "Score 500"; "Next round" button shown.
Round 7 (rule "Match by SHAPE", target blue triangle "blue"): verdict "Correct!" with sub-line "Matched by shape: blue triangle"; chosen red triangle tile highlighted green with a green check badge; header "Score 500" → "Score 600"; "Next round" button shown.
Round 8 (rule "Match by SHAPE", target red square "red"): verdict "Not quite" with sub-line "The match was blue square — matched by shape."; chosen red triangle tile outlined red with red X; blue square tile highlighted green; score unchanged at 600; "Next round" shown.
Round 9 (rule "Match by SHAPE", target red circle "red"): verdict "Correct!" with sub-line "Matched by shape: red circle"; chosen green circle tile outlined green with a green check badge; header "Score 600" → "Score 700"; "Next round" shown.
Round 10 (final round; banner "Infer the sorting rule", target red square "red", rule switched): verdict "Correct!" with sub-line "Kept — sorted correctly under the hidden rule."; chosen red triangle tile highlighted green with a green check badge; header "Score 700" → "Score 800"; a "See results" button appeared in place of "Next round".
NOTE (input): multiple coordinate taps on the Round 4 board did not register (board unchanged after 3 tries); only a tap issued through the element index landed — later coordinate taps while a stale element list was held also missed.

## 3. Pause & Resume
Opened by tapping the board's "Pause" button (id flexibility-card-sort.pause) during Round 2/10. Overlay id flexibility-card-sort.pause-overlay: heading "Paused", caption "The challenge is hidden and the timers are frozen.", exactly two buttons: "Resume" (filled red, primary) and "Quit" (dark, secondary). Board chips remained in the tree beneath (round.2 / score / rule-banner / target-card). Resume tapped → board returned to Round 2/10 with Score 100 preserved, timer no longer frozen.

## 4. Final Result Screen
Headline: "Solid work" (id result-headline) with a result-artifact/"world" card above.
Big score: 800 (id score-animated).
Stat lines verbatim (label -> value): Accuracy -> 80% (id .accuracy); Speed -> 0% (id .speed); After rule switches -> 100% (id .switch-accuracy); Discovery rounds -> 100% (id .discovery-accuracy); Best streak -> 4 (id .best-streak); Mistakes -> 2 (id .mistakes); XP -> 36 (id .xp).
Reward (id .reward): "Reward  +36 XP  ·  +7 coins" with the confirmation line "Progress saved" underneath — i.e. +36 XP and +7 coins granted to the account.
Buttons: "Play again" (id .restart) and "Done" (id .quit). Screen root id flexibility-card-sort.results.

## 5. Input & Exit
Input registering: yes — taps registered immediately in normal play. Board answer taps, "Pause", "Resume", "Next round", "See results", "Got it" and "Done" all took effect within one turn, with the board updating at once. ONE exception: on the Round 4 board three consecutive coordinate taps did not register (board unchanged) while the same option did register when tapped through its element index; later coordinate taps issued against a stale element list also missed.
Exit: tapping "Done" (id flexibility-card-sort.quit) on the FINAL RESULT screen left the game cleanly and landed on the app's Games list — header "Games" / "Browse all games", the category chips "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games", and a "Card Sort / Flexibility game / Learning" tile listed.
Return: re-firing the deep link `braintraining://game/flexibility-card-sort` re-opened this same game (am start reported the intent delivered to the running instance, exit 0), and the screen rendered the Card Sort intro again — title "Card Sort", category "Flexibility", description "Match cards by the active rule — the rule keeps switching, so stay flexible.", difficulty chips Easy/Normal/Hard/Expert/Adaptive with Normal selected, "Start game" and "How to play". Safe exit and return both confirmed.

## 6. Defects
1. Input reliability on the play board: on the Round 4/10 board three consecutive coordinate taps on the correct option card did not register (board completely unchanged, no feedback), while the identical option registered when tapped through its element index. Same class of miss recurred later when tapping with a stale element list. No user-visible error or "missed" feedback is shown, so a player tapping a card can get silently no-op input.
2. Transient hidden/unreachable action on the intro: while the tutorial notice ("Rule switched!" / "Got it") was on screen, the intro's "Start game" control existed in the accessibility tree but its bounds coincided with the "How to play" card region and it was not visibly rendered/reachable; it became fully visible and tappable once the tutorial finished.
No clipped/garbled text, no low-contrast text, no overlapping controls and no unreachable controls were observed on the live play board, the pause overlay or the result screen; board hierarchy is clear (round/score chips on top, rule banner, target, prompt, 2x2 options). Note: repeated `uiautomator dump` "Segmentation fault" failures were a dump-tool issue on this device, not an app UI defect.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
