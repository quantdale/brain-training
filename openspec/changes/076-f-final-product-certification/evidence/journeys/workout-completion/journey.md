# Controller journey — `workout-completion`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `3e4f7da4-ec0a-4d4f-be42-a3574d20bd6c` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 124
- Journey log: PRESENT

# Journey Log

## Planned steps
1. Confirm the locked app `com.braintraining.app` is on the in-progress multi-game workout result screen (workout = 4 games).
2. From the current per-game result screen, tap "Next game" (NOT "Play again" / "Done") to continue the workout.
3. Clear any game intro/countdown screen and play game 3 (Reaction Time) to completion; record its result screen (score + reward) and the "UP NEXT" line.
4. Tap "Next game" again and play game 4 to completion; record its result screen (score + reward).
5. Capture the final workout-complete / workout-summary screen: exact text, TOTAL reward (XP + coins), and the next options offered.
6. Record everything in this note under the four required headings.

## Executed steps  (what you really did, in order)
1. (T+00:48) Read the live screen: in-progress workout per-game result screen — "Keep training", Final score 170, Accuracy 20%, Rounds passed 1/5, Best streak 1, Longest sentence 7 words, XP 17, Reward "+17 XP · +3 coins", "UP NEXT: Reaction Time / Game 3 of 4 · progress saved". Buttons: "Next game / Reaction Time · Game 3 of 4", "Play again", "Done".
2. 

## Observed outcome (quote exact on-screen text)
- Baseline (pre-journey) per-game result screen: "Keep training" / Final score 170 / Accuracy 20% / Rounds passed 1/5 / Best streak 1 / Longest sentence 7 words / XP 17 / "Reward  +17 XP  ·  +3 coins" / "Progress saved" / "UP NEXT  Reaction Time  Game 3 of 4 · progress saved"
- Workout-complete screen (exact text): 
- Total reward: 
- What the app offers next: 

## Defects (or 'none observed')
- 
3. (T+01:34) Tapped "Next game · Reaction Time · Game 3 of 4" on the result screen. Landed on the Reaction Time intro page: "React / Speed / Reaction Time", "Back to games", "TODAY'S WORKOUT", Difficulty options (Easy/Normal/Hard/Expert/Adaptive; Normal selected), "How to play" text, "Try a demo", "Start game".

4. (T+05:53) Pressed BACK to dismiss the "How to play" overlay on the intro page; instead it popped the intro page, returning to the per-game result screen ("Keep training / Final score 170 / Reward +17 XP · +3 coins / UP NEXT: Reaction Time · Game 3 of 4").

5. (T+06:24) Tapped "Next game" again → Reaction Time intro page re-opened with the "How to play" tutorial card on top (title "How to play"; text "Watch the big button. After a random wait it turns green — tap it the instant it does. Your reaction time is measured in milliseconds. Tap too early and the round is a false start: too many and the session ends." / "From Normal upward some rounds flash red with an ✕ instead: that one asks you to HOLD — keep perfectly still until it fades. Tapping it costs a false start; withholding it scores like a fast round.") and a "Try a demo" button.

6. (T+07:33→07:41) Demo ran: green "GO!" button appeared ("Demo / Tap the button now!"); tapped it. Then a "You've got it" card appeared (text: "Ready to play for real — remember: early taps are false starts, red ✕ signals mean hold still, and the challenge hides during pauses, so keep your finger close.").

7. (T+08:29) Tapped "Got it" → tutorial closed, leaving the clean intro page: "React / Speed / Reaction Time", "Back to games", "TODAY'S WORKOUT — Game 3 · your next game", difficulty Normal selected, buttons "Start game / Game 3 · ready when you are" and "How to play".

8. (T+09:08) Tapped "Start game" → Reaction Time session started. Screen: "Round 1/10", "Score 0", "Pause", status "Timed out / No reaction / The signal went unanswered. / Prompt: tap the instant it turns green", button "Next round". (Round 1 timed out unanswered.)

9. (T+~11:00) Round 2 also auto-resolved as "Timed out" (Score 0). Round cycle observed: header "Round N/10" + "Score 0" + "Pause"; stage card either "Get ready — tap the instant it turns green / False starts left: 1 / Tap when it turns green" (live round) or the result card "Last round: timed out / Timed out / No reaction / The signal went unanswered. / Prompt: tap the instant it turns green" + button "Next round". Rounds do not self-advance; "Next round" must be tapped.

10. (T+12:01) Burst (tap Next round + wait 1400ms + tap stage) advanced to Round 3/10 with a live green "GO!" signal ("GO — tap now"); tapped the green signal. Mechanic: a false-start meter ("False starts left: 1") limits premature taps, so rounds are being advanced by letting each time out and pressing "Next round".

11. (T+12:42) Round 4/10 showed a red ✕ "hold" signal verdict: "Tapped ✕ / Don't tap! / That signal asked you to hold — it costs a false start. / Prompt: hold — do not tap the ✕ signal" (red "Next round" button). My burst's tap cost the false start. Sequence so far: R1 timed out, R2 timed out, R3 tapped green GO!, R4 false start (tapped the no-go ✕).

12. (T+13:58) Advanced past Round 4 via "Next round" → Round 5/10 started live ("Get ready — if the button flashes red with an ✕, do NOT tap", "False starts left: 0", stage "Tap when it turns green"). Score still 0.

13. (T+14:37) Round 5 result: "Held! / You held still on the ✕ signal — nicely done." (Prompt: hold — do not tap the ✕ signal). Score now 100. Tapping "Next round" to continue.

14. (T+15:18) Round 6/10 result: "Timed out / No reaction / The signal went unanswered." Score 100. Advancing to Round 7.

15. (T+16:45) Round 7/10 result: "Held! / You held still on the ✕ signal — nicely done." Score 200. Advancing to Round 8.

16. (T+17:48) Round 8/10 result: "Timed out / No reaction / The signal went unanswered." Score 200. Advancing to Round 9.

17. (T+18:39) Round 9/10 result: "Timed out / No reaction / The signal went unanswered." Score 200. Advancing to Round 10 (final round of Reaction Time).

18. (T+19:07) Round 10/10 live — green "GO!" button showing (Score 200). Tapping the green signal to respond.

19. (T+19:29) Round 10/10 final result: "Timed out / No reaction / The signal went unanswered." Score 200 (my tap on the green GO was refused — the sub-second signal had expired). Card offers "See results" instead of "Next round". Reaction Time final score: 200.

20. (T+19:46) GAME 3 RESULT SCREEN (Reaction Time, Game 3 of 4) after tapping "See results". Exact text on screen:
"Keep training" card; "Final score  200"; "Median reaction  –"; "Best reaction  –"; "Mean reaction  –"; "Rounds passed  2/10"; "✕ signals held  2/3"; "False starts  1"; "XP  12"; "Reward  +12 XP  ·  +2 coins"; "Progress saved"; buttons "Play again" and "Done".
(No "Next game" row visible on this frame — scrolling down to look for "UP NEXT Game 4 of 4 / Next game".)

21. (T+20:02) Scrolled down on the Game 3 result screen to reveal the rest: "UP NEXT / Color Stroop / Game 4 of 4 · progress saved" and buttons "Next game / Color Stroop · Game 4 of 4", "Play again", "Done". → Tapping "Next game" to enter the final game (Color Stroop, Game 4 of 4).

22. (T+20:47) GAME 4 INTRO — Color Stroop (Game 4 of 4, category "Switch / Flexibility"). Exact on-screen text: "Color Stroop"; "Back to games"; "TODAY'S WORKOUT / Game 4 · your next game"; "Identify the ink color of color words, tracking rule flips between 'ink' and 'word' modes."; "Difficulty / Normal" (easy/normal/hard/expert/adaptive options, Normal selected); overlay card "Welcome to Color Stroop! / You will see color words displayed in different ink colors." with a red "Next" button. → Tapping "Next".

23. (T+22:24) Cleared the Color Stroop onboarding cards in order: 1) "Welcome to Color Stroop! / You will see color words displayed in different ink colors." [Next] → 2) "Answer the INK Color / By default, tap the button matching the color the word is written in, not what the word says. (Word says RED, but it's written in red ink → Answer: red)" [Next] → 3) "Watch for Rule Changes! / Sometimes a 'RULE CHANGE!' banner appears. After that, tap the color the WORD says instead." [Next] → 4) "Speed Matters / Faster correct answers earn more points. Try to respond quickly but accurately!" [Got it!]. Clean intro page now shows "Start game / Game 4 · ready when you are" and "How to play". → Tapping "Start game".

24. (T+22:54) Color Stroop session started: header "Trial 1/15 · Score 0 · Rule: INK", "Pause" button, word "TABLE" shown in blue ink, four answer buttons: red, blue, green, yellow. Rule INK → answered "blue" (ink color).

25. (T+23:21) Color Stroop trial 1: my tap on "blue" was intercepted — the 1500ms trial timer expired first; overlay showed "Time's up! / It was blue / 1500ms", Score 0, and a red "Next trial" button. Key mechanic: each trial has a 1500ms limit (far shorter than my per-turn latency), so every trial will time out and require a "Next trial" tap to continue.

26. (T+24:01) Color Stroop trial 2: header "Trial 2/15 · Score 0 · Rule: INK", word "BLUE" written in red ink (correct INK answer = red); 1500ms timer expired before a tap could land → timed out again. Advancing with "Next trial" at norm (500,578).

