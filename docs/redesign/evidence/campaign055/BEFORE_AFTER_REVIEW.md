# Campaign 055 — Before / After Review

Baseline artifact: `f59c066` release APK, SHA-256
`1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`.
Final artifact: Campaign 055 release APK, SHA-256
`9E6B94FCED9A70DDBE828C99734D846DF7A1DB4ED5F42B3FFDC6691A236A367A`
(109,593,933 bytes).
Device: `braintraining-ui35` / `emulator-5554`, 1080×2400 @ 420, font scale 1.0,
light unless stated, same emulator profile for both runs. ADB/emulator-local
capture only.

Raw pixels: `D:\Temp\campaign055\{before-light,before-dark,after-light,after-dark}`
Committed: `screens/before/*.jpg`, `screens/after/*.jpg`,
`contact-sheet-before.jpg`, `contact-sheet-after.jpg`.

| Surface | Before | After | What changed |
| --- | --- | --- | --- |
| Home (completed) | `before/home.jpg` | `after/home.jpg` | Hero card stack → one artifact: world stage, TODAY kicker, promise, completed band, progress, single key; legs moved to a hairline "Today's plan" report. |
| Home (active) | Campaign 052 `home-today.jpg` + `before/home.jpg` structure | `after/home-active.jpg` | Fresh plan reads `0/4`, "Next: Word Scramble", one `Start workout` key above a `Today's plan` report — the first viewport answers "what should I play now?". |
| Games | `before/games.jpg` | `after/games.jpg`, `after/games-scrolled.jpg` | Repeated banner→badge→paragraph card stack → featured storefront stage + 2-up poster grid with identity-first tiles and a one-rail filter strip. Internal rating removed from the reason line. |
| Game Detail | `before/game-detail.jpg` | `after/game-detail.jpg` | Neutral framed hero → world stage (art, kicker, gameTitle, interaction) with Play directly beneath; Records demoted to hairline reports. |
| Game intro / tutorial | `before/game-intro.jpg`, `before/tutorial.jpg` | `after/game-intro.jpg`, `after/tutorial.jpg` | Intro now leads with the world stage and identity; the tutorial shell is a compact game-reveal card (small radius, accent rail) around the same per-game steps. |
| Gameplay | `before/gameplay.jpg` | `after/gameplay.jpg` | Header is a compact instrument strip on a bordered surface (round rail + score + pause); mechanic and board unchanged. |
| Result (in-session) | `before/ingame-result.jpg` (also Campaign 052 `result.jpg`) | `after/ingame-result.jpg` | Duplicate score and report spacing gone; artifact + hairline facts + factual reward row; 0% stays honest (no green, no "earned!", no confetti). |
| Result (route) | `before/result.jpg` | `after/result.jpg` | Game world joins the artifact; band headline + ring; quiet reward row; rating/recent sessions as hairline reports; "New personal best" no longer appears on weak first sessions. |
| Progress | `before/progress.jpg` | `after/progress.jpg` | Consistency rail + focal rating ring first; administrative definition copy removed; every figure/window unchanged. |
| Profile | `before/profile.jpg` | `after/profile.jpg` | "Local player / Indigo accent" record card → player identity panel (monogram, name, level emblem, XP, streak rail, equipped cosmetic chips); records/settings in hairline reports. |
| Rewards | `before/rewards.jpg`, Campaign 052 `rewards.jpg` | `after/rewards.jpg`, `after/rewards-grid.jpg` | Percentage hero → claim band; emoji/scrim tiles → code-native collectible plates with owned/equipped/locked states and quiet per-slot progress. |
| Dark Games | `before/dark-games.jpg` | `after/dark-games.jpg` | Authored dark palette kept; storefront composition and poster grid replace the stacked cards. |
| Dark Result | `before/dark-result.jpg` | `after/dark-result.jpg` | Dead space and low-separation panels replaced by the artifact + flat reports on the ink canvas; coral key unchanged. |

## Matched-state notes

- Home completed and the route Result were captured with the same persisted
  device state before and after where possible; the final Result capture is a
  genuinely played release session (weak band), which is the honesty case.
- The tutorial capture required resetting one persisted tutorial row on the
  device between runs (test state, not product data).
- Compact and font-scale-2 matrices are in `ACCESSIBILITY_RESPONSIVE_QA.md`.

---

# Final-artifact certification section (2026-09-20, pixel-certification session)

This is the first time the Campaign 055 before/after claims are verified against
trustworthy **composited pixels of an exact final artifact** rather than
hierarchy evidence. Certified artifact: release APK SHA-256
`99D1D132FD21E4A49D46EF10997305D62949291B1771F755E7B010200C990C55`
(109,595,521 bytes) from product checkpoint `34c9b2d`; six-way matrix, 66/66
canonical + 42/42 interaction captures, full accessibility classification and
the runtime matrix in `PIXEL_CERT_MATRIX.md`; contact sheets under
`screens/final-cert/contact-*.jpg`; curated full-frame surfaces beside them.

## Candid assessment against the Campaign 055 intent

| Claim | Verdict on final pixels |
| --- | --- |
| Less dashboard grammar | **Holds.** Home is one artifact + one key + a hairline plan report; Progress leads with consistency/rating; Profile demotes records. No stacked KPI cards remain. |
| One focal object per surface | **Holds.** Home artifact, Games featured stage, Detail world stage, one result artifact, Profile identity panel. |
| Identity before metadata | **Holds.** Poster tiles lead with game identity art; detail leads with the world and verb before facts. |
| Honest result bands | **Holds.** 0% sessions render “Keep training” with no celebration and a neutral, separate reward row; the route Result repeats the honest band from persisted data. |
| Single score presentation | **Holds after repair.** The certification found and removed a duplicate unrounded `Score` row in ten games; the focal numeral is now the only score on every in-session result. |
| Collectible Rewards | **Holds.** Code-native plates with owned/equipped/locked states; claim rows with visible keys in both themes. |
| Credible Progress | **Holds.** Focal rating/consistency, sparse-data honesty, drill-down copy in player language. |
| Authored dark mode | **Holds.** Ink canvas with re-authored world art and coral keys; dark clearly differs from a simple inversion. |
| Gameplay prominence | **Holds after repair.** Mechanic-first board; the instrument strip wraps at large text so the Pause control stays reachable, and the mechanic stage dominates. |
| Games desirability | **Holds.** Storefront composition with featured stage and identity-first 2-up posters; search and filter rail remain truthful and usable at every profile. |

## What materially changed since the first-session after-images

- The three defects repaired in this session (HUD pause clipping, duplicate
  unrounded score row, clipped tutorial retry) are visible improvements over
  the earlier after-images; before/after crops are committed as
  `defect-hud-*.jpg` and `fixed-hud-*.jpg`.
- The dark-mode and font-scale-2 evidence is now real pixels on every required
  surface rather than hierarchy-only evidence.

## Remaining visual debt (honest)

- Game-owned short-board dead space in some gameplay stages (Class B,
  mechanic-owned; unchanged, `LOW_ACCEPTED_DEBT`).
- At font-scale-2, Game Detail's `Add to favorites` and the route-Result
  primary action sit just below the first fold (scrollable containers;
  `CLIPPED_BUT_REACHABLE`, `LOW_ACCEPTED_DEBT`).
- The HUD wraps to a second instrument line at large text/compact widths; this
  is the intended graceful behaviour rather than debt.
- Human TalkBack/VoiceOver quality, physical-device and iOS rendering remain
  outside this session's boundary.
