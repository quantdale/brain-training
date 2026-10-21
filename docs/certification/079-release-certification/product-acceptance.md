# Product acceptance matrix — Campaign 079

**Date:** 2026-10-21 · **Runtime:** dedicated AVD `braintraining-qa36`
(x86_64, 1080x1920), QA APK sha256 `231559b935b4…` (52,735,180 B,
`-PreactNativeArchitectures=x86_64`), installed `-r` over existing owner data.
**Evidence:** screenshots + UI hierarchies under local `qa-artifacts/`
(gitignored by design; raw device artifacts stay off Git), smoke run id
`20261021-052945-app-smoke`.

## 1. End-to-end journey review (C2)

| # | Surface | Disposition | Evidence / notes |
|---|---|---|---|
| 1 | First launch / initial loading | KEEP | cold start 2887 ms; no blank or crash state observed |
| 2 | Onboarding / first-run comprehension | NOT RE-TESTED | owner device has prior data; first-run path covered by tests + 077/078 evidence |
| 3 | Home / dashboard | KEEP | `home-01.png`: wordmark, streak/level/coins strip, workout card with illustration, clear Start CTA, offline affordance, Today's plan, tab bar |
| 4 | Games discovery / search | KEEP | `079-acceptance-games.png`: "Explore your skills", suggested game with reason ("undertrained Attention domain"), New chip, "More good fits" |
| 5 | Categories / domains | KEEP (tested) | domain chip present (Scan · Attention); full taxonomy covered by tests |
| 6 | Game detail | KEEP | `079-acceptance-detail.png`: mechanic summary, tutorial note, Play CTA, favorites, "Make your first run" empty state, Game information |
| 7 | Tutorial / demonstration | KEEP (REFINE candidate) | intro → interactive demo → "You've got it" → Got it flow is genuinely good; demo-first design teaches mechanic by doing |
| 8 | Game Start interaction | KEEP | difficulty select (Easy/Normal/Hard/Expert) + "Start game" + "How to play" re-entry; Start correctly absent while tutorial open (078-era fix holds) |
| 9 | Gameplay | KEEP (partial) | Round x/6 header, score, Pause, timer, board render (`079-acceptance-round1.png`); correct-tap feedback NOT VALIDATED this session |
| 10 | Pause / resume / quit | NOT RE-TESTED | Pause control present and labeled; behavior previously validated (077/078); pause-in-feedback fix (F-10a) unit-covered |
| 11 | Failure / retry / completion | KEEP (timeout path) | timeout → encouraging feedback ("it beat the clock this time") → Next round; rounds advanced 1→4 cleanly |
| 12 | Results / reward feedback | NOT RE-TESTED | covered by tests; native results screen previously qualified |
| 13–14 | Workout creation / execution | NOT RE-TESTED | Home workout card shows V3 plan (4 games · ~8 min, ordered plan list) |
| 15 | Progress / analytics | NOT RE-TESTED | tab present; previously qualified |
| 16 | Achievements / quests / cosmetics | NOT RE-TESTED | economy state preserved across upgrade install |
| 17 | Profile / settings | NOT RE-TESTED | tab present; previously qualified |
| 18 | Data export / import / recovery | NOT RE-TESTED | unit-covered incl. large-backup probe (performance.md) |
| 19 | Offline startup / continued play | PARTIAL | "Ready to play offline." affordance visible; offline boundary CI-gated; airplane-mode journey not re-run |
| 20 | Background / terminate / relaunch | NOT RE-TESTED | relaunch after force-stop worked (cold start 2486 ms) |

## 2. 42-game matrix (C3)

- **Automated coverage:** 42/42 games' mechanics, scoring, reducers and state
  machines under the 711-suite / 8,018-test suite (app source unchanged from
  `0e1c8784` through `9c4dd138`).
- **Native interactive coverage this session:** Odd One Out (1/42) journeyed
  through detail → tutorial → interactive demo → difficulty → active round →
  timeout feedback → round advancement. The remaining 41/42 were NOT
  natively re-executed this session; their native qualification stands on
  Campaign 077/078 evidence (retained in place, not relabeled).
- **Per-game evaluation dimensions** (gameplay correctness, tutorial accuracy,
  comprehension, responsiveness, scoring, failure handling, pause, exit,
  results, accessibility, consistency, responsiveness, visual identity,
  friction, confusion, offline): fully populated for Odd One Out above; for
  the other 41 the automated suite covers correctness dimensions and the
  077/078 native records cover visual/interactive dimensions at their dated
  revisions. **Remaining gap:** fresh native re-execution of 41 games.

## 3. Visual design review (C4)

Reviewed surfaces (Home, Games discovery, Game detail, tutorial, gameplay)
show coherent "Play Lab" design: consistent typography scale, restrained
palette with clear primary-action blue, meaningful illustration on the
workout card, clear information hierarchy, generous touch targets
(Play CTA 372x63 dp-equivalent; tiles ~97 dp), empty-state copy that reassures
("Your results stay saved on this device"), and motion-free static clarity.
Disposition for reviewed surfaces: **KEEP**. Known 078-era REFINE candidates
remain open P3s (OddOneOut triangle affordance, rule-switch discoverability,
GridRecall echo scale, ReactionTime depth).

## 4. Findings from this session

No P0/P1/P2 product defect found in the exercised journey. Observed notes:

- **P3 (tooling, not product):** uiautomator-dump latency (~4–5 s) exceeds
  Odd One Out round timers (~9–10 s), making dump-driven play-throughs
  impractical; ARTEMIS natural-language journeys or in-app QA fixture paths
  are the correct tool for per-round interactive validation.
- **P3 (product, pre-existing, unchanged):** the 078-era visual notes above.

## 5. Unvalidated paths (explicit)

First-run onboarding, results/reward screens, workout execution, progress,
profile/settings, export/import recovery, offline airplane journey,
background/relaunch, pause/resume/quit, correct-tap scoring feedback,
41/42 games natively, all TalkBack/screen-reader behavior, compact/font-scale
profiles (previously sampled in 077/078, not re-run), dark-mode surfaces
(previously sampled).
