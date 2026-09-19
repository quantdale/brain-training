# Campaign 055 — Surface Change Matrix

Classification from `docs/redesign/evidence/campaign052/VISUAL_DEBT_MAP.md`.
Every change maps to a locked role or a Campaign 052 finding; nothing else moved.

| Surface | 052 class | Before (baseline) | After (campaign 055) | Shared system used |
| --- | --- | --- | --- | --- |
| Home / Today | REFINE | Hero card stacked world art + FOCUS MODULE + TODAY + promise + 0/4 + bar + CTA + four leg rows + trust line; stats grid card below | One focal artifact: full-bleed world stage ("TODAY'S FOCUS") + compact promise + progress + primary key; legs in a "Today's plan" Report; streak/level/coins in a "Your training" Report | ArcadePanel focal, GameWorldArt stage, Report/ReportRow, gameTitle voice |
| Games discovery | RETHINK | Suggested-next banner + badge + title + rating paragraph + "Open details"; every game repeated the same large card grammar | Featured storefront stage (world art + identity + one key + reason) then a dense poster grid (2-up compact); identity before metadata; quieter search/filter chrome | GameStage, GamePosterTile, SectionHeader, Chip |
| Game Detail | REFINE | Neutral hero card with framed art + identity row + rules paragraph; Records table prominent below | `GameStage` hero (world, kicker, gameTitle, interaction), Play key immediately under; Records/recent demoted to hairline Reports | GameStage, ArcadePanel, Report/ReportRow, gameTitle voice |
| Tutorial / intro | REFINE | Form-like card: title, difficulty selector, "How to play" paragraph, See an example; overlay card with large radius | Game-reveal shell (small radius, top accent rail) around the same per-game steps; intro uses the game stage so the world precedes the rules | TutorialFrame, GameStage |
| Active gameplay | KEEP* | Mechanic-first board on a neutral panel; generic cells; header row cramped; ~45% dead space below board | Architecture preserved; compact instrument strip header (round pips + score + pause) on a bordered surface; game stage identity retained; no mechanic change | SessionHeader, ProgressBar |
| Results (in-session) | RETHINK | "Session complete", duplicate `Final score`/`Score`, metric list, green "XP earned!" panel on weak sessions, two equal actions | One focal artifact (world + band/game headline) → hairline supporting report → factual reward row (no false success; confetti only for strong outcomes) → single primary key plus quiet secondary | ArcadePanel focal, resultHeadline voice, Report rows, honest band gate |
| Results (route) | RETHINK | Ring hero card without game art, reward card, rating card, recent-sessions card | Artifact with game world + band headline + ring + game + date; quiet reward row; hairline rating and recent Reports; same single primary CTA logic | GameWorldArt stage, ArcadePanel focal, Report/ReportRow |
| Progress | REFINE | "At a glance" analytics card with three equal numerals and definition copy; stacked cards | Consistency rail first, focal composite panel, then player-language Reports; every number/window/chart unchanged | ArcadePanel focal, Report/ReportRow, bodyRead voice |
| Profile | RETHINK | "Local player / Indigo accent" card, Level/XP tiles, streak card with four stat tiles, purchases, settings | Player identity panel first (name, level emblem, XP, streak rail, equipped cosmetic chips), records and settings in hairline Reports | ArcadePanel focal, Report/ReportRow, StreakStrip, CollectibleTile chips |
| Rewards | REFINE | Percentage hero, claim panels, three progress rows, small emoji/scrim cosmetic tiles | Claim band hero when rewards are ready; collection as code-native CollectibleTile grids per slot with owned/equipped/locked states and quiet n/12 rails | CollectibleTile, ArcadePanel, Report, Badge |
| Dark mode | KEEP | Authored dark palette preserved; weak separation inside long stacked cards, dead space on dark Result | Same authored hues; separation improved by the new composition (flat reports on canvas, fewer nested cards); no inversion introduced | Tokens unchanged |
| Copy | — | "recorded movement", "next consideration", "Local player", "Indigo accent", rating 986, raw float ms, duplicate completion lines | See `COPY_AND_LABEL_AUDIT.md` for the exact old → new table | — |

\* Gameplay was classified KEEP by the debt map and called weak by the
independent critic. Resolution: preserve the mechanic-first architecture and
raise the surrounding chrome (header, tutorial/intro continuity) without
touching any mechanic, timer, generator, difficulty or scoring path.
