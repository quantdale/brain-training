# Controller journey — `interrupted-resume`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `c9df15ae-9317-4845-97fa-b89b50504fcf` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 0
- Journey log: PRESENT

# Journey Log — com.braintraining.app (background / resume)

## Planned steps
1. Enter an ACTIVE game from the "Keep training" workout summary (summary showed Score 142, Accuracy 20%, Speed 64%, Rounds passed 1/5, Best streak 1, Correct answers 1/4, Timeouts 1, XP 17, banner "Reward +17 XP · +3 coins" / "Progress saved", card "UP NEXT Sentence Builder · Game 2 of 4 · progress saved").
2. Play 2-3 rounds partway; record the PARTIAL state as the pre-background resume anchor.
3. Send the app to the background (HOME key), then bring com.braintraining.app back to the foreground.
4. Compare the post-return screen against the anchor; report exactly what was preserved (or the reset).

## Executed steps (what you really did, in order)
1. T+01:33 tapped "Next game" (bottom-left of the "Keep training" summary card) -> Sentence Builder SETUP screen ("Game 2 · your next game", Difficulty Normal, "Start game").
2. T+02:18 tapped "Start game" -> ACTIVE round began: "Round 1/5", "Score 0", category "Idiomatic Expressions", tiles the/was/He/feeling/weather/under.
3. Round 1: tapped only "He" then "was" -> round timer expired -> "Round failed / Correct order: He was feeling under the weather". Score still 0.
4. Tapped "Next round" -> "Round 2/5", category "Comparatives", tiles than/elephant/a/rhinoceros/is/heavier/An.
5. Round 2: burst-tapped "An, elephant, is, heavier", then "than, a", then "rhinoceros" -> still too slow -> "Round failed / Correct order: An elephant is heavier than a rhinoceros". Score 0.
6. Tapped "Next round" -> "Round 3/5", category "Idiomatic Expressions", tiles decided/night/call/a/to/it/They.
7. Round 3: burst-tapped They -> decided -> to -> call, then it -> a -> night -> "Round passed! +170 points". Score 170, "3 of 5 rounds complete".
8. T+05:02 pressed the system HOME key from the "Round passed!" interstitial -> app backgrounded (verified via `dumpsys window`: top focus = com.google.android.apps.nexuslauncher/.NexusLauncherActivity).
9. T+05:36 tapped the "Brain Training" launcher icon -> app returned to foreground showing "Paused / The challenge is hidden and the timers are frozen." with Resume / Quit.
10. T+05:53 tapped "Resume" -> the in-progress round was restored exactly as left ("Round 3/5", "Score 170", "Round passed!").

## Observed outcome (quote exact on-screen text)
PRE-BACKGROUND ANCHOR (active Sentence Builder, Game 2 of 4, workout Round 3/5):
- "Round 3/5"
- "3 of 5 rounds complete"
- "Score 170"
- Category: "Idiomatic Expressions"
- "Round passed!"
- "+170 points"
- "\"They decided to call it a night\" in 7 taps"
- Button: "Next round"

POST-RETURN (immediately after relaunch from the launcher icon, T+05:36) — a game pause overlay:
- "Paused"
- "The challenge is hidden and the timers are frozen."
- Buttons: "Resume" / "Quit"
=> The app auto-paused on going to background instead of losing progress; state preserved, timers frozen.
(Tapping "Resume" to reveal the restored in-progress state — see next entry.)

POST-RETURN (after tapping "Resume", T+05:53) — the SAME in-progress state as the pre-background anchor, verbatim:
- "Round 3/5"
- "3 of 5 rounds complete"
- "Score 170"
- Category: "Idiomatic Expressions"
- "Correct order: They decided to call it a night"
- "Round passed!"
- "+170 points"
- "\"They decided to call it a night\" in 7 taps"
- Button: "Next round"
=> Identical to the pre-background anchor. The workout resumed exactly where it left off (same game, same round, same score, same round outcome); nothing was reset and no progress was lost.

## Defects (or 'none observed')
The journey DID execute end-to-end: workout started (Sentence Builder, Game 2 of 4), played partway (Rounds 1-3 of the 5-round workout; Score 170), backgrounded via HOME, relaunched from the launcher, resume confirmed.
- none observed in the resume behavior itself. Two non-blocking observations:
  1. Backgrounding auto-pauses the game ("Paused / The challenge is hidden and the timers are frozen." with Resume/Quit) rather than silently continuing — an intentional-looking design, and state was fully intact after Resume.
  2. Round timers are short (~10s); game rounds 1 and 2 failed on Timeout due to operator turn latency, not app defects.
- Environment note: the stale pre-action screenshot briefly showed the previous game frame while the app had already backgrounded (verified via `dumpsys window`: top focus = com.google.android.apps.nexuslauncher). No app defect.

## Verdict
PASS — the app preserved the in-progress workout across background/foreground: on return it showed the identical "Round 3/5 / Score 170 / Round passed! (+170 points)" state from before backgrounding, and play continued from there.
