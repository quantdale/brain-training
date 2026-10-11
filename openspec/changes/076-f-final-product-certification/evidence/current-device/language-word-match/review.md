# Current-device acceptance — `language-word-match`

- Date: 2026-10-11T13:55:58+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-language-word-match`
- ARTEMIS session: `92f580f0-bc5b-42df-8cbc-d967add50d9f` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — language-word-match (com.braintraining.app)
Identity confirmed cold-start via deep link braintraining://game/language-word-match:
- Screen id: language-word-match.screen; Title "Word Match"; Category "Language"
- Description: "Pick the word that means the same as the prompt — four options, one perfect match."
Intro screen: difficulty radios Easy / Normal (selected) / Hard / Expert / Adaptive; buttons "Start game", "How to play", "Back to games".

## 1. Active Play Board
- Header chips: "Round 1/6" + a horizontal progress bar; "Score 0" beneath it; top-right button "Pause".
- Card contents: small "Score 0" readout; prompt instruction "Pick the synonym"; stimulus word in large bold: "small"; sub-line "Answer within 8s" (timer is a text countdown, no separate numeric chip).
- Every visible control + literal label: 4 answer buttons — "loud", "spotless", "miniature", "opulent" (full-width outline buttons); "Pause" button top-right.
- Instructions visible: yes ("Pick the synonym", "Answer within 8s").
- Legibility/hierarchy: clear — large bold stimulus word, medium-weight options, high contrast light-on-dark; hierarchy stimulus > options > meta text.
- Board-level a11y ids noted: chips `language-word-match.round.N`, `session-progress` (content-desc "3 of 6 rounds complete"), `language-word-match.score` ("Score 0"), `language-word-match.time-budget` ("Answer within 8s"), options `language-word-match.option.0..3`, header "Pause" button `language-word-match.pause`.

## 2. Scored Feedback
Round 1 timed out (answer tap arrived after the 8s timer expired). Timeout reveal, verbatim:
- Headline: "Time's up" (amber/yellow).
- Detail box: "The answer was miniature" and ""miniature" means the same as "small"".
- The correct option "miniature" is revealed filled GREEN with a "✓" checkmark; the other three ("loud","spotless","opulent") stay plain outlines.
- Primary action button: "Next round" (red/pink filled).
- Score remains "Score 0" (no point awarded on timeout).
- CORRECT verdict (Round 3, answered "glance" for stimulus "gaze"): headline "Correct!" (green); detail pill ""glance" means the same as "gaze""; the chosen option rendered filled green with a "✓" (a11y "Correct: radiant"-style); wrong options listed as "unsightly, locked", "powerless, locked", "unhappy, locked"; primary button "Next round". Score chip went 0 → 140.
- CORRECT verdict (Round 4, answered "radiant" for stimulus "beautiful"): headline "Correct!"; pill ""radiant" means the same as "beautiful""; "✓ radiant" green; "cool, locked", "scorching, locked", "steep, locked". Score 140 → 281.
- Scoring observed: a correct answer adds ~140 points; a timeout adds 0; a wrong answer adds 0.
- INCORRECT verdict (Round 5): headline "Not quite" (red/salmon); detail box "The answer was impoverished" / ""impoverished" means the same as "needy""; the correct option "✓ impoverished" filled GREEN, the wrong pick "✗ false" filled SALMON/red, other options "finalize" and "leisurely" left plain dark; primary button "Next round". Score unchanged at 281.
- So all three feedback states were captured verbatim: timeout ("Time's up"), correct ("Correct!"), incorrect ("Not quite").
Round 2 (stimulus "hot") also timed out with the same pattern — verbatim "Time's up" / "The answer was sweltering" / ""sweltering" means the same as "hot"", correct option "sweltering" revealed green with ✓; Score still 0.

## 3. Pause & Resume
- "Pause" button (top-right of the round card) opens a full-screen dark overlay.
- Overlay text verbatim: title "Paused"; subtitle "The challenge is hidden and the timers are frozen."; two buttons: "Resume" (red/pink filled, primary) and "Quit" (dark/grey outlined, secondary).
- The overlay hides the board and freezes the 8s round timer (confirmed: board content remained unchanged while the overlay was open).
- Resumed successfully via "Resume" and play continued on the frozen round.

## 4. Final Result Screen
Reached after all 6 rounds (Round 6 timeout "Time's up / The answer was affordable", button changed "Next round" → "See results"). Header card shows a mini game-icon tile (blue outlined shapes) with a "trophy/medal" badge top-right and the heading "Keep training".
- "Final score" = 281 (large, centered)
- Accuracy = 33%
- Rounds correct = 2/6
- Best streak = 2
- Avg answer time = 4.8s
- XP = 19
Reward block: "Reward  +19 XP · +3 coins" with subtext "Progress saved".
Buttons: "Play again" (filled red) and "Done" (dark).

## 5. Input & Exit
- Did taps register immediately? Yes. Every tap that was aimed at the live target registered with no perceptible lag: the "Resume"-then-answer bursts landed and produced the green "Correct!" verdicts (Rounds 3 and 4), "Next round"/"See results" advanced rounds on the first tap, and "Pause" opened the overlay at once.
- Two answer taps were blocked before touching the screen (Pre-Execution Safety Net, pixel "target disappeared") because the 8s round timer expired during the ~14s decision cycle and the board re-rendered into the "Time's up" state; this is round-timer expiry, not input lag. Nothing was lost — those rounds simply timed out.
- Exit: from the Final Result screen the "Done" button returned to the Games list ("TRAIN YOUR BRAIN / Games", "Browse all games", filter chips "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games"). No crash, no confirmation dialog, no stale game left on screen.
- Return: typed "Word Match" into the "Search games..." field → list filtered to "Showing 1 of 42 games" with the single "Word Match / Language / Learning" card; tapping it re-opened the game (detail page: "Word Match", Language, "Match the prompt with the word that means the same.", "Play Word Match", "Add to favorites", Mastery 1 "Learning", Records SESSIONS 3 / BEST 23% / AVERAGE 13%). Safe exit and return proven.

## 6. Defects
- none observed for rendering: no clipped or truncated text, no overlapping/clipped controls, no low-contrast unreadable labels, no hidden or unreachable action. All controls (Pause, Resume, Quit, Next round, See results, Play again, Done) were visible and tappable.
- One design note (not a rendering defect): the round budget is shown only as text "Answer within 8s" with no visible numeric countdown chip, and 8 seconds is tight for reading the prompt plus four long options — several rounds timed out while the answer was being decided.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
