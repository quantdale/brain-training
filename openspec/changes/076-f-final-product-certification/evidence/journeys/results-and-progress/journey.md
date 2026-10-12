# Controller journey — `results-and-progress`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `dae4edc0-2840-4475-8a1a-46aaa5f2dd8f` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1500 s wait cap, NOT the journey outcome)
- Journey log: PRESENT (all four sections carry substantive content)

# Journey Log — com.braintraining.app

_Locked app: only interacted with package `com.braintraining.app`._
_JOURNEY: Play a training session, then open the post-play RESULTS surface and the PROGRESS/stats surface, and report what personal record, streak and progress data is shown._

## Planned steps
1. Launch/foreground the locked app and locate the play entry point and the progress/stats entry point.
2. Open a training game and complete at least one full session; capture the post-game RESULTS surface verbatim.
3. Open the PROGRESS / stats surface; capture the personal-record, streak and progress data verbatim.
4. (Fallback for streak) Read the Home surface streak stat (`home-stat-streak-item`) since the Progress surface has no streak section.
5. Record everything into this note with the four required headings and an explicit execution verdict.

## Executed steps  (what you really did, in order)
1. T+01:10 — Started on the "CLAIM & COLLECT / Rewards" surface (the app was already foregrounded, not on the play/progress screen). BACK exited the app; relaunched `com.braintraining.app`.
2. T+04:18 — App relaunched → HOME surface ("BRAIN TRAINING" / "Home", bottom nav Home/Games/Progress/Profile; "Today's Workout" 4 games).
3. T+04:30 — Tapped **Games** in the bottom nav → GAMES surface ("TRAIN YOUR BRAIN" / "Games", 42 games listed).
4. T+04:40 — Tapped the **Odd One Out** card → Odd One Out game-detail surface.
5. T+05:07 — Tapped **Play Odd One Out** → play-setup sheet (Difficulty "Normal" selected).
6. T+05:24 — Tapped **Start game** → session board "Round 1/6", "Score 0", "Tap the odd one out".
7. T+05:55 – T+08:39 — Played all 6 rounds. Every round ended in the "Time's up" timeout state before my tap could land (action-turn latency ~13–18 s exceeded the ~10 s round timer). Tapped the odd tile in Rounds 3, 5, 6 — each tap was intercepted pre-execution by the safety net (pixel_target_disappeared, round already ended). Tapped "Next round" after Rounds 1–5 (Round 6 button reads "See results").
8. T+08:52 — Tapped **See results** → post-game RESULTS surface captured verbatim.
9. T+09:24 — Tapped **Done** on the RESULTS surface → returned to Odd One Out game-detail (SESSIONS went 1 → 2).
10. T+09:45 — Pressed BACK → GAMES list.
11. T+09:56 — Tapped **Progress** in the bottom nav → PROGRESS surface opened.
12. T+10:09 – T+17:38 — Scrolled the PROGRESS surface top-to-bottom in successive passes, recording every section verbatim (Consistency, Sessions/Active days/Per active day, Overall rating, Domain ratings, Summary 30d, Training balance, Most trained/Needs attention, Evenness, This week, Activity, Session volume, Recent vs lifetime, Personal best, Workout completion, Category comparison, Training breadth & results, Full history, Per game, Recent, Mastery, Closest milestones) → **reached the page bottom**: no streak section exists on the Progress surface.
13. T+18:05 – T+19:56 — Switched to the **Home** tab and read the "Your training" section: Day streak, Level/XP, Coins verbatim.

## Observed outcome (quote exact on-screen text)

### Post-play RESULTS surface (Odd One Out, session #1) — T+09:01
- Banner: "Keep training" with round-progress tiles
- "Score  0"
- "Accuracy  0%"
- "First-try rate  0%"
- "Rounds passed  0/6"
- "Best streak  0"
- "Timeouts  6"
- "XP  10"
- "Reward  +10 XP · +2 coins" / "Progress saved"
- Buttons: "Play again" | "Done"
- **No explicit "personal best" row was shown on this results screen** (score was 0). The only record-like field on it is "Best streak  0" (in-session best streak).

### PROGRESS / stats surface — personal record
- "Personal best"
  - "01 BEST SESSION — 17%"
  - "02 SET — Oct 11"
  - "03 STANDING — Today"
  - "04 TIMES RAISED — 1"
  - Footnote: "Every time you set a new personal best, from your recorded results. If two sessions tie, the earlier one keeps the mark."
- Per-game record shown on the Odd One Out detail: "BEST 0%" / "AVERAGE 0%" / "SESSIONS 2 / Last played Today"

### PROGRESS / stats surface — streak
- **No dedicated "streak" section exists on the Progress surface** (verified by scrolling to the page bottom; last block is the "Mastery reflects capability inside each game…" footnote).
- Streak-related values that ARE on Progress: "Workout completion — 03 CURRENT RUN — 1d" and "Games finished inside workouts: 4 of 4 assigned · longest completed run 1d."

### HOME surface — streak (the surface that actually carries the streak stat)
- Section "Your training"
- "Day streak" — numeral "1" (large orange), 7-circle week row (1st filled orange, 2nd outlined orange), badge "⚡ 1"
- Caption: "2 days to Getting Started · 3-day streak"
- "Level" — "13 XP to Level 2" / right side "87 XP"
- "Coins" — "16"

### PROGRESS / stats surface — progress data (verbatim highlights)
- Header: "YOUR TRAINING RECORD" / "Progress" / "Your consistency, recent form and what to try next."
- Window selector: "7d" | "30d" (selected) | "90d" | "All"
- "Consistency" (badge "30d"), 14-day strip, caption "Last 14 days"
- "01 SESSIONS — 7 sessions"; "02 ACTIVE DAYS — 1 active day"; "03 PER ACTIVE DAY — 7.0"
- "OVERALL RATING  981" / "Matching your lifetime average · last 30d"; ring "5 of 8"
- "01 TRAINED DOMAINS — 5"; "02 UNTRAINED — 3"; "03 STALE · HALF WEIGHT — 0"
- Footnote: "Average of all 8 domain ratings. Untrained domains start at 1000; stale updates count half."
- "Suggested next": "Memory — Not trained in this window yet"
- Domain ratings: Memory "—" (Untrained), Attention "940 ▼ -55", Speed "957 ▼ -38", Math "—" (Untrained), Language "990", Logic & Problem Solving "—" (Untrained), Flexibility "986", Spatial "976 ▼ -14" (each "Fresh · trained 0d ago")
- "Summary" (badge "30d"): "01 LEVEL — 1", "02 XP — 87", "03 SESSIONS (30D) — 7", "04 COINS — 16"; "87 / 100 XP to level 2"
- "Training balance" (badge "5/8 domains"); "Most trained" — Attention (2 sessions · 29%); "Needs attention" — Speed (1 session · 14%)
- Rows: Attention 2× · 29%, Spatial 2× · 29%, Speed 1× · 14%, Language 1× · 14%, Flexibility 1× · 14%
- "Not trained in this window: Memory, Math, Logic & Problem Solving."
- "Evenness: 4.5 effective domains of 8 (63% coverage)."
- "Activity: Sep 12 – Oct 11", "1 active days · 7 sessions in this view", "01 Full activity calendar >"
- "Session volume": "This window (30d) 7" vs "Previous window 0", "▲ +7 sessions vs previous window", "1 active day · 1.6 sessions/week"
- "Recent vs lifetime" (badge "30d"): AVERAGE "6% · 6% Δ 0%", "Rolling last-5-session average: 1%", ACCURACY "7% · 7% Δ 0%"
- "Workout completion": "01 DONE (LAST 30) — 1/1", "02 RATE — 100%", "03 CURRENT RUN — 1d", "04 ALL-TIME — 1"
- "Category comparison": Spatial 976 ▼-14 (2× · avg 8%), Attention 940 ▼-55 (2× · avg 0%), Language 990 (1× · avg 17%), Speed 957 ▼-38 (1× · avg 5%), Flexibility 986 (1× · avg 0%), Memory/Math/Logic & Problem Solving "—" (0× this window)
- "Training breadth & results": "01 5 DOMAINS / DAY — 1 day · 6% avg"
- "Full history" row: "Per-domain trends, game records and recent sessions."
- "Recent" rows: "Odd One ... 0%", "Mental Rotati... 0%", "Odd One ... 0%", "Color Stroo... 0%", "React ion Ti... 5%", "17% PB >"
- "Mastery": New 37, Learning 5, Developing 0, Proficient 0, Advanced 0, Mastered 0
- "Closest milestones": Odd One Out "learning · Play 3 more sessions to leave the basics", Color Stroop "learning · Play 4 more…", Sentence Builder "learning · Play 4 more…", Mental Rotation "learning · Play 3 more…"
- Closing footnote (page bottom): "Mastery reflects capability inside each game — difficulty reached and recent performance — never time spent alone."

## Defects (or 'none observed')
- Not "none observed". The following were observed:
  1. **Played session scored 0 across the board** — every one of the 6 rounds timed out ("Time's up") because the ~10 s round timer is shorter than the operator action-turn latency (~13–18 s). Result: Score 0, Accuracy 0%, First-try rate 0%, Rounds passed 0/6, Best streak 0, Timeouts 6. This is a real outcome of the run, not a UI fault.
  2. **Pre-Execution Safety Net interceptions** (pixel_target_disappeared) on the odd-tile taps in Rounds 1–5, because the round had already ended when the tap fired.
  3. **Progress surface has no "streak" section** although the APK recon listed a `progress-streak...` test-id token — the streak stat is only rendered on the Home surface (`home-stat-streak-item`) and the results surface ("Best streak").
  4. One `task_plan` edit returned a "may have applied inaccurately" warning (later re-verified manually).
  5. Minor: "Per game" / "Recent" rows on the Progress surface render truncated game names (e.g. "Odd One ...", "Mental Rotati...").

### Execution verdict (anti-false-pass)
**The journey WAS actually executed end-to-end.** PLAY → the app launched, Games → Odd One Out → Start game → 6 rounds were played and a full session was completed (Round 6 reached, "See results" offered) → the post-game RESULTS surface was displayed and quoted verbatim (T+09:01: Score 0, Accuracy 0%, Rounds passed 0/6, Best streak 0, Timeouts 6, XP 10, Reward +10 XP · +2 coins, "Progress saved"). PROGRESS → the Progress tab was opened from the bottom nav and scrolled to its page bottom, with the personal record ("BEST SESSION 17%"), streak-adjacent data ("Workout completion CURRENT RUN 1d") and extensive progress data captured verbatim. The one gap in the requested data — a dedicated **streak** figure — was explicitly chased: the Progress surface was proven (page-bottom reached) to contain no streak section, so the Home surface was opened to read the streak stat verbatim ("Day streak 1", "2 days to Getting Started · 3-day streak").
Verdict: PASS — journey executed; results surface, personal record, streak and progress data all observed and quoted verbatim.


### Session context / pre-existing state (T+00:43)
- App already foregrounded: `com.braintraining.app/.MainActivity`, showing "CLAIM & COLLECT / Rewards" surface (NOT the play or progress screen).
- Rewards screen verbatim: "3 rewards ready to claim"; "Claim all 3"; "14 coins · Earn coins from play, quests and achievements."
- Rewards to claim: "First Steps — Complete your first training session. +50 XP +25 coins"; "Explorer — Play 5 different games. +100 XP +50 coins"; "Play Three Games — Complete 3 sessions today. +20 XP +5 coins".
- Collection: "3/12"; Avatar Frames "1/5"; Accents "1/4"; Celebrations "1/3".
- Avatar Frames row: "Classic Ring. Equipped"; "Bronze Ring. Locked. Win achievement ach-25"; "Silver Ring. Locked. Reach a 30-day streak".

## Recon findings (T+05:00) — app internals (from APK asset `index.android.bundle`)
- App config: name "Brain Training", slug "brain-training", scheme `braintraining`, package com.braintraining.app, expo-router (typedRoutes), sdk 57.
- Single activity: `com.braintraining.app/.MainActivity` (deep link scheme `braintraining://`). No separate activities for progress/results.
- Route tokens: `/progress`, `/progress-activity`, `/progress-detail`, `/progress-domain`, `/progress-game`, `/results`.
- Test-id tokens: `home-*` (home-title, home-stat-level, home-stat-xp, home-stat-coins, home-stat-streak-item, home-streak-card-tracker, home-workout-cta, home-workout-templates, home-quick-games-*, home-recent-*), `progress-*` (progress-view, progress-summary, progress-detail-pb-header, progress-personal-best-history, progress-streak..., progress-activity-heatmap, progress-domain-stats, progress-game-pb-score-animated, progress-mastery), `results-*` (results-title, results-score, results-metric-accuracy-value, results-metric-score-value, results-metric-difficulty-value, results-metric-time-value, results-xp, results-personal-best-proximity, results-play-again, results-next-*, results-finish-workout, results-session-persist-*).
=> There IS a HOME surface (home-*) with streak/level/XP/coins stats and a workout CTA; a PROGRESS surface (progress-*) with personal-best history; and a post-play RESULTS surface (results-*).

### Additional verbatim captures (surfaces used en route)
- HOME (T+04:24): "BRAIN TRAINING"/"Home"; "Today's Workout — 4 games · about 8 minutes"; "Your training is ready on this device and works offline."; "Workout complete — 4/4 games saved. See today's progress for a summary."; button "See today's progress / 4/4 games saved"; "Today's plan": Mental Rotation (Spatial, Done), Sentence Builder (Language, Done), Reaction Time (Speed, Done), Color Stroop (Flexibility, Done).
- GAMES (T+04:35 / re-seen): "TRAIN YOUR BRAIN"/"Games"/"Pick a game to train a skill. New games appear here as they are added."; "Search all games"; "Browse all games"; chips "All 42", "Memory 7", "Attention 5", "Speed 5"; "Showing 42 of 42 games"; cards Odd One Out (Scan/Learning), Signal Watch (Watch/New), Symbol Tracker (Track/New), Target Count (Count/New).
- GAME DETAIL Odd One Out (T+05:02 / T+09:34): "Scan"/"Attention"; "Scan the board and tap the one item that breaks the pattern."; "Includes a short guided tutorial on first play."; "Play Odd One Out"; "Add to favorites"; Mastery "1 of 5, Learning" ("Play 4 more sessions to leave the basics" before the session → "Play 3 more sessions…" after); Records "SESSIONS 2 / Last played Today"; "BEST 0%"; "AVERAGE 0%"; "View detailed trends for this game".
- PLAY SETUP (T+05:12): Difficulty "Normal" selected (Easy/Normal/Hard/Expert/Adaptive); "Start game"; "How to play": "Every board has exactly one item that differs from the others…".
- SESSION (T+05:47–T+08:39): "Round 1/6"…"Round 6/6", "Score 0", "Pause", prompt "Tap the odd one out", per-round countdowns (6.8s…11.5s); each round ended with "Time's up" / "The odd one is highlighted — it beat the clock this time."
