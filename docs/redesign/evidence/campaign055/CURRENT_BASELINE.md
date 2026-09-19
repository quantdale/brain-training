# Campaign 055 — Current Baseline (f59c066)

**Repository baseline:** `698bfd3` (synchronized remote `main`; prompt-only commit
on top of `f59c066`). Product/source baseline reviewed visually: `f59c066`
release artifact, unchanged executable product source since `02a7ecb`.
**Device:** `braintraining-ui35` / `emulator-5554`, Android 15 / API 35,
1080×2400 density 420, font scale 1.0, GMT.
**Baseline artifact:** `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
SHA-256 `1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`
(the Campaign 054 release artifact, verified installed and re-hashed at baseline).
**Raw captures:** `D:\Temp\campaign055\before-light\`, `D:\Temp\campaign055\before-dark\`
(before) and the Campaign 052 committed packet under
`docs/redesign/evidence/campaign052/screens/` (historical reference).

## Method

ADB/emulator-local only. Deep links (`braintraining:///<route>`) with
force-stop before each navigation, then a stable-frame settle check before the
capture. Baseline device state: 7 persisted sessions across attention, logic and
language games, one completed daily workout (`2026-09-19`, 4/4), schema v12,
integrity `ok`, 42/42 tutorials completed.

## What the baseline actually shows (fresh pixels, not prose)

### Home — `before-light/before-home.png`

Two composited states (fresh plan vs completed). The completed state stacks:
page title → hero card (world art + FOCUS MODULE + game title + domain meta) →
TODAY + "Today's Workout" + promise copy + "Workout complete 4/4" summary →
progress strip → primary key → four rows of upcoming games → context/streak
card → templates → recent/history. The hero art is a framed diagram, and at
least six groups compete at similar weight. The session's own words: "View
today's progress for a summary" sits inside a card that also shows 4/4.

### Games — `before-light/before-games.png`

"Suggested next" card = full-width banner art + "★ Recommended" badge +
"Learning" meta + domain eyebrow + 32px-heavy game title + "weak Language domain
(rating 986)" + "Open game details ›". Beneath it, "MORE GOOD FITS" repeats the
identical banner→badge→title→copy grammar per game. The internal domain rating
(`986`) is exposed as player-facing copy. Game identity is only visible as a
framed schematic after scanning the card; composition between all 42 games is
identical.

### Game Detail — `before-light/before-game-detail.png`

Order is already identity-first (world banner → Track/Visual search identity →
domain → title → rule paragraph → mastery ring → Play key → favorite → Records
`Sessions/Best/Average`). The lower half reads as analytics (Records table) and
the hero remains an instructional diagram.

### GameHost intro — `before-light/before-game-intro.png`

Hero card repeats the Game Detail world banner; then workout context, title,
rules card, difficulty meta, Start key, "How to play". Paints as a product form
rather than anticipation.

### Gameplay (Campaign 052 committed pixel, `active-gameplay.jpg`)

Mechanic-first and legible: round pips + instruction + 3×3 board. But the board
is a neutral panel of nine soft cells on a pale canvas with ~45% of the viewport
dead below the board, and the cells are visually generic.

### Result (routes)

Two distinct surfaces exist and were previously conflated:

1. In-session `components/game-host/results.tsx` ("Session complete" screen,
   Campaign 052 `result.jpg`): duplicates the score twice, prints
   `Fastest answer 2948.3300000000745 ms`, prints a metric table, and shows a
   green `+18 XP earned!` reward panel on a 0/5 performance.
2. Standalone `app/results.tsx` (`before-light/before-result.png`): already
   closer to a designed result (band word "Keep going", ring 30%, 2×2 metric
   strip, reward row, Play again) but still leads with an empty "New personal
   best" badge when applicable and closes with an analytics "Rating movement"
   card.

### Progress — `before-light/before-progress.png`

"At a glance" report card with three equal-weight numerals, two paragraph
paragraphs of measurement language, a next-consideration row, then a second
equal card with the radial. Window control is a quiet pill row. Reads as
analytics software.

### Profile — `before-light/before-profile.png`

Header: "Your local training record, motivation and settings." Identity card =
placeholder avatar square, "Local player", "Level 1 · Indigo accent", Level and
Total XP tiles, XP progress bar. Then "MOTIVATION / Keep your rhythm", a Streak
card with four equal stat tiles, day tracker, next milestone, and two purchase
rows. Settings/data continue below the fold. Record management, not identity.

### Rewards — `before-light/before-rewards.png`

Hero "3/12 cosmetics collected (25%)" → "Ready to claim" inbox → "Collection"
with three progress rows → "Avatar Frames" grid of small emoji/scrim squares
with Equipped / locked tiles. Functional, inventory-like, provisional art.

### Dark — `before-dark/before-*.png`

Dark Home keeps coral keys and cream headings but canvas/surface/sunken planes
separate weakly inside long stacked cards; dark Results has large dead space.
Dark Game Detail remains the strongest dark composition.

## Protected technical floor verified at baseline

- `node scripts/validate-repo-state.mjs` → PASS (terminal 054 state).
- Release APK installed and hash-identical to the Campaign 054 artifact.
- Device SQLite: schema v12, integrity `ok`, no duplicate sessions.
- 564 suites / 6,726 tests / 5 snapshots is the recorded Campaign 054 terminal
  Jest baseline (re-verified during this campaign's final matrix).
