# Controller journey — `workout-completion`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `2b30a3ef-c5ae-4216-acf3-353dc39cfaeb` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1500 s wait cap, NOT the journey outcome)
- Journey log: PRESENT (all four sections carry substantive content)

# Journey Log — com.braintraining.app multi-game workout (session T+00:00 → T+08:00)

## Planned steps
1. Orient on the locked app com.braintraining.app: identify the active game, workout progress (round X/5), and on-screen controls; dismiss any pause/onboarding/ads overlay so the workout can resume (starting state: rotation-matching round mid-play, "Round 1/5", "Score 0", "Next round").
2. Progress the workout game-by-game, completing every round of each game, until the workout-complete summary screen appears.
3. Reach and capture the workout-complete screen.
4. Record the total reward (coins/points/XP/stars) and what the app offers next.

## Executed steps (what I really did, in order)
1. T+00:35 Observed the starting screen: rotation-matching game — "Is the candidate the target rotated?", "Round 1/5", "Score 0", round 1 already over with "Time's up — The timer ran out. The correct answer was 'Same'." Controls: "Same" / "Different", "Next round", "Pause". Logged this to journey_log.
2. T+00:43 Tapped "Next round" (first dispatch bounced because the active milestone had no in-progress sub-goal; re-issued after opening one).
3. T+01:02 Tried to answer live "Round 2/5" by tapping "Same" — the tap was intercepted by the Pre-Execution Safety Net (target_disappeared: element 'Same' (spatial-mental-rotation.same) not found). Round 2 then timed out too: "The timer ran out. The correct answer was 'Same'."
4. T+01:19 → T+02:40 Advanced rounds via repeated "Next round" taps (bursts of tap + 18 s wait), carrying rounds 3, 4 and 5 (all timed out, "Score 0").
5. T+03:19 Tapped the single bottom button on the Game #1 result screen to continue the workout (no control labelled "Done" was present on that frame).
6. T+03:43 Waited 2500 ms; the frame settled and revealed the Home tab in a WORKOUT-COMPLETE state.
7. T+04:19 Tapped "See today's progress" / "4/4 games saved" and read the Progress tab ("YOUR TRAINING RECORD") over several scrolls.
8. T+05:28 Tapped the "Profile" tab and, after the page settled from an initial stale/frozen frame, read the cumulative totals and all Profile sections.
9. T+08:00 Tapped the "Equipped cosmetics … Opens Rewards" row and read the Rewards store ("CLAIM & COLLECT") for the remaining "what's next" offers.

## Observed outcome (quote exact on-screen text)
Game #1 result screen (spatial-mental-rotation, T+03:04):
- "Keep training"; "Accuracy 0%"; "Speed 0%"; "Rounds passed 0/5"; "Best streak 0"; "Correct answers 0/0"; "Timeouts 5"; "XP 10"; "Reward  +10 XP  ·  +2 coins"; "Progress saved"; buttons "Play again" / "Done".

Workout-complete screen (Home tab, T+03:58) — REQUIRED DELIVERABLE:
- "BRAIN TRAINING" / "Home"; "TODAY" / "Today's Workout" / "4 games · about 8 minutes · balanced across your recent training." / "Your training is ready on this device and works offline."
- Card: "Workout complete" / "4/4 games saved. See today's progress for a summary." over a full progress bar; CTA "See today's progress" / "4/4 games saved".
- "Today's plan": "Mental Rotation" (Spatial) — Done; "Sentence Builder" (Language) — Done; "Reaction Time" (Speed) — Done.

Total reward:
- Per-game reward shown on the Game #1 result screen: "Reward  +10 XP  ·  +2 coins".
- Cumulative account balance (Profile tab, settled): "Level 1", "77 of 100 XP", "TOTAL XP 77", "DAY STREAK 1", "COINS 14"; "1 day streak, today is in progress"; "Longest streak 1 days"; "Protection items 0".
- (An earlier Profile frame showed a stale "0 TOTAL XP / 0 DAY STREAK / 0 COINS — No XP yet"; the settled values after the page rendered are the ones recorded above.)
- The Home workout-complete card itself carries NO numeric reward line; the coin/XP figures are only on the Profile tab.

What the app offers next (exact text):
- Home CTA: "See today's progress" / "4/4 games saved".
- Progress tab: "OVERALL RATING 984" / "Matching your lifetime average · last 30d"; "5 of 8 domains trained"; "SESSIONS 6" / "ACTIVE DAYS 1" / "PER ACTIVE DAY 6.0"; "Suggested next: Memory — Not trained in this window yet"; "Domain ratings": Attention 954 ▼ -41, Speed 964 ▼ -31, Language 990 (Memory and Math untrained).
- Profile tab: streak-milestone ladder 01 "Getting Started" 1/3 days "+30 XP / +15 coins · 2 days to go" … 07 "Year Strong" 1/365 days "+5000 XP / +2000 coins · 364 days to go"; buyable protection items "Freeze × 0 – 100 coins", "Shield × 0 – 150 coins", "Recovery × 0 – 200 coins"; "Quests: 1 quest reward available in Rewards."
- Rewards store ("CLAIM & COLLECT" / "Rewards" / "Claim what you earned, then grow your collection." / "rewards ready to claim"): "3 rewards ready to claim" with button "Claim all 3"; "14 coins · Earn coins from play, quests and achievements. Spend only on safe cosmetics."; claimable rewards listed as "First Steps — Complete your first training session. (+50 XP / +25 coins)", "Explorer — Play 5 different games. (+100 XP / +50 coins)", "Play Three Games — Complete 3 sessions today. (+20 XP / +5 coins)"; "Collection 3/12" (Avatar Frames 1/5, Accents 1/4, Celebrations 1/3; "Classic Ring. Equipped", "Bronze Ring. Locked. Win achievement ach-25", "Silver Ring. Locked. Reach a 30-day streak").

## Defects (or 'none observed')
- PARTIAL JOURNEY — must be stated: the workout was NOT played game-by-game end to end in this session. At session start the app was already mid-workout on game #1 (rotation-matching, Round 1/5). Only that single game was played through its 5 rounds; after tapping the result screen's bottom button the app reported "Workout complete — 4/4 games saved", with the other three plan items (Mental Rotation, Sentence Builder, Reaction Time) already marked "Done". Only 1 of the 4 games was actually played here.
- Round timer shorter than decision latency: every one of game #1's 5 rounds ended in "Time's up" (Accuracy 0%, Speed 0%, Rounds passed 0/5, Correct answers 0/0, Timeouts 5), so no answer could be registered. Advancing was only possible via the persistent "Next round" control.
- Intercepted action (consecutive failure #1): tap 'Same' — "Pre-execution validation failed: Target element 'Same' (spatial-mental-rotation.same) expected at [254, 2086] … was not found on the screen."
- Two stale/frozen UI frames: the Game #1 result screen persisted in the screenshot while the live UI tree already showed Home; and the Profile tab first rendered "0 TOTAL XP / 0 DAY STREAK / 0 COINS — No XP yet" before settling to 77 / 1 / 14.
- The "1 quest reward available in Rewards." line under "Quests" is static text — tapping it did nothing; the Rewards store is reached from the "Equipped cosmetics … Opens Rewards" row instead.
