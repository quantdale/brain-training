# Controller journey — `daily-workout`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `01b84927-b471-4d62-92b8-6306cc10babe` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 0
- Journey log: PRESENT

# Journey Log — com.braintraining.app (Brain Training)

## Planned steps
1. Bring the app to its Home screen (tab was on Profile; tap "Home" in bottom nav).
2. Locate today's Daily Workout entry point and read the workout composition (games count + ordered list).
3. Start today's workout via the primary start control.
4. Enter the first game of the workout and capture the transition into gameplay.

## Executed steps (in order)
1. [T+01:04] App was on Profile tab; tapped the "Home" tab in the bottom navigation. Home dashboard appeared.
2. [T+01:17–01:37] Swiped up on the Home page to reveal the full "Today's plan" list (4th row, "Color Stroop", was below the fold).
3. [T+01:54] Tapped the red "Start workout" button ("Starts with Mental Rotation · 4 games").
4. [T+02:05] Landed on the Mental Rotation game detail screen ("TODAY'S WORKOUT / Game 1 · your next game", difficulty Normal, "How to play").
5. [T+02:19] Tapped "Try an example" -> entered an interactive round ("Example 1 of 2" with Target/Candidate and Same/Different buttons).
6. [T+02:37] Tapped "Same" -> round advanced to "Example 2 of 2" (still active gameplay with play area + answer buttons).

## Observed outcome (exact on-screen text)
Home — Daily Workout card:
- "TODAY" / "Today's Workout"
- "4 games · about 8 minutes · a balanced starting set."
- "Your training is ready on this device and works offline."
- "0/4" / "0 of 4 complete" / "Next: Mental Rotation"
- "Start workout" / "Starts with Mental Rotation · 4 games"
Home — "Today's plan" (4 games):
1. "Mental Rotation" — "Spatial" — "Now"
2. "Sentence Builder" — "Language" — "Up next"
3. "Reaction Time" — "Speed" — "Up next"
4. "Color Stroop" — "Flexibility" — "Up next"
First game detail (Mental Rotation):
- "Rotate" / "Spatial" / "Mental Rotation"
- "TODAY'S WORKOUT" / "Game 1 · your next game"
- "Decide whether the candidate shape is a rotated copy of the target — or a different shape."
- "Difficulty" / "Normal" (Easy, Normal, Hard, Expert, Adaptive)
- "How to play": "Compare the two shapes. If the candidate is the target rotated in your mind's eye — every block and its color in the same arrangement — answer “Same”. If it is mirrored or has a block changed, answer “Different”. Answer before the timer runs out."
Transition into gameplay:
- "Example 1 of 2" -> "Same = an exact rotated copy (colors move with the blocks)." -> "Target" / "Candidate" / buttons "Same" "Different"
- After answering: "Example 2 of 2" (same layout, round counter advanced)

## Defects
none observed
