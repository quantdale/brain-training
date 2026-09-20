# Campaign 055P — Pixel Certification Matrix (exact final artifact)

Session: 2026-09-20 (pixel-certification continuation of
`055-signal-arcade-desirability`). Environment proof and runtime ownership:
`PIXEL_CERT_ENVIRONMENT.md`.

## Certified artifact (terminal)

| Field | Value |
| --- | --- |
| Product-source checkpoint | `f95c5dd` (fix commit below) |
| APK | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| SHA-256 | `2208174A68380F4F457EFEFF9E6A854A725DE041FC592888431D65D6075A0796` |
| Size | 109,596,305 bytes |
| Package / version | `com.braintraining.app` v0.1.0, debug-signed release, Metro-independent |
| Device | `braintraining-ui35` / `emulator-5554`, 1080×2400 @ 420 dpi |

The earlier `A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`
artifact was invalidated by the genuine defect repair recorded below; all
terminal pixel evidence in this file is from the new artifact.

## Why the artifact changed — a real defect found by these pixels

The first six-way capture exposed a genuine Campaign 055 layout defect that the
earlier semantic passes could not see:

> The in-session HUD instrument strip is a single non-wrapping row. At compact
> width or a 2× system font scale the round/progress/score/pause slots exceed
> the strip, so the trailing **Pause** control overflowed the strip and was
> clipped past the screen edge — only `6×44 dp` visible at font-scale-2 (both
> themes), squeezed to `37×44 dp` at compact, and already bleeding past the
> strip frame at default scale.

Hierarchy proof (pre-fix): `memory.pause` bounds `[1054,217][1038,333]` at
font-scale-2 (left edge past the right edge), `[42,2278]…`-class clip at
default/compact; pixel proof: `screens/final-cert/defect-hud-pause-clipped-default.jpg`,
`defect-hud-pause-offscreen-fs2.jpg`.

Repair (smallest fix, checkpoint `f95c5dd`):

- `components/game-ui/session-header.tsx` — the strip wraps
  (`flexWrap: 'wrap'`) so overflow moves to a second instrument line instead
  of hiding a control.
- `components/game-ui/game-button.tsx` — the `small` variant sizes to its
  content; the wide 120 dp floor stays on the default variant. The forced
  floor was what pushed the pause past the strip.
- New focused tests: `session-header.layout.test.tsx` (wrap contract) and a
  `game-button.a11y.test.tsx` case (small variant has no forced wide floor).

Post-fix proof (same three profiles, on the new artifact):
`fixed-hud-default.jpg`, `fixed-hud-compact.jpg`, `fixed-hud-fs2.jpg` — the
pause measures `87×44 dp` (default), `87×44 dp` (compact), `121×44 dp`
(font-scale-2) and is fully inside the screen in all three.

No mechanic, scoring, persistence, routing, copy or accessibility-semantic
change; the HUD information set is identical, only its row can wrap.

## Method

- Canonical harness: `scripts/qa/ui-capture.mjs --device emulator-5554
  --profile <p> --theme <t>` (11 route surfaces per combination).
- Interaction surfaces (Games scrolled, search/filter, active gameplay,
  in-session Result) plus post-play states (route Result, Progress, Rewards
  with claimables): bounded emulator-local ADB driver
  `qa-artifacts/campaign055-pixel/interaction-capture.mjs` (not product
  source; documented here because the canonical harness is route-only).
- Pixel validity: `qa-artifacts/campaign055-pixel/analyze-matrix.py`
  (dimensions, unique colours, luminance mean/σ, 8×8 average-hash uniqueness,
  route-marker re-verification from the saved hierarchies, dark-vs-light and
  profile-vs-profile deltas).
- Accessibility: `scripts/qa/a11y-audit.mjs` per profile with the capture's
  true density (420/320/420).
- Raw captures are in `qa-artifacts/campaign055-final-cert/` (gitignored);
  committed evidence is this document plus the curated images under
  `screens/final-cert/`.

## Six-way canonical matrix (exact final artifact)

`node scripts/qa/ui-capture.mjs --device emulator-5554 --profile <p> --theme light,dark`:

| Combination | Surfaces | Result |
| --- | --- | --- |
| default / light | 11 | PASS |
| default / dark | 11 | PASS |
| compact / light | 11 | PASS |
| compact / dark | 11 | PASS |
| font-scale-2 / light | 11 | PASS |
| font-scale-2 / dark | 11 | PASS |

**66/66 canonical captures**: every PNG nonblank with correct dimensions
(1080×2400 default/font-scale-2, 720×1600 compact), nonzero luminance
variance, route markers re-verified from each saved hierarchy, no repeated
frame across routes (8×8 average-hash uniqueness), dark clearly darker than
light per surface, and every profile's layout genuinely different from the
others. Zero blank, zero duplicates, zero route mismatches.

## Interaction surfaces (same six combinations)

Bounded emulator-local driver (Games scrolled/library, search/filter, active
gameplay, in-session Result) plus the state-dependent surfaces after a played
session (route Result, Progress with a rating, Rewards with claimables):

| Combination | Extra surfaces | Result |
| --- | --- | --- |
| default / light | 7 | PASS |
| default / dark | 7 | PASS |
| compact / light | 7 | PASS |
| compact / dark | 7 | PASS |
| font-scale-2 / light | 7 | PASS |
| font-scale-2 / dark | 7 | PASS |

**42/42 interaction captures valid** (search shows the truthful
“Showing 7 of 42 games”; gameplay shows the live round/score HUD; the
in-session Result shows one score, an honest band and a separate reward; the
route Result shows the persisted weak session). All 108 captures (66 + 42)
scanned for system-dialog contamination: **0** contaminated frames.

## Accessibility over the terminal matrices

`node scripts/qa/a11y-audit.mjs --dir qa-artifacts/campaign055-final-cert/<p>
--density <420|320|420>`:

| Profile | Surfaces | Measured `target<44dp` | Unlabelled | Clipped (unmeasured) |
| --- | --- | --- | --- | --- |
| default | 36 | 28 | 0 | 14 |
| compact | 36 | 21 | 0 | 12 |
| font-scale-2 | 36 | 18 | 0 | 14 |

Terminal classification of every measured finding (source-verified):

| Classification | Count |
| --- | --- |
| `COMPLIANT_PARENT_OR_HITSLOP` (Progress 7d/30d/90d/All via the shared `Tappable` hit-slop; `Clear search` via the `IconButton` Tappable) | 52 |
| `CLIPPED_BUT_REACHABLE` (fold/rail clips: route-Result `Play again`, fs2 `Add to favorites`, Games `Open game details`, the horizontal filter-rail chips, the scrolled-out `Math, 5` sliver) | 11 |
| `MEASUREMENT_ARTIFACT` (`Search all games`: the interactive `TextInput` fills the shared `TextField` box whose outer bounds are 44 dp including the hairline border) | 4 |
| `TRUE_UNDERSIZED_TARGET` | **0** |
| unlabelled interactive nodes | **0** |
| decorative-art leaks (unlabelled `ImageView`/`ReactImageView` nodes across all 108 dumps) | **0** |

The previously-recorded 27 compact observations remain correctly classified;
the HUD `Pause` finding is closed by the defect repair (it no longer appears in
any matrix), and no new profile/theme-specific accessibility defect appeared.

## Visual review — Campaign 055 intent on the final pixels

| Surface | Verified in pixels |
| --- | --- |
| Home | one dominant daily artifact (world stage + TODAY + plan), single coral CTA, quiet “Today's plan” report |
| Games | storefront: featured stage + identity-first 2-up poster grid; search shows the truthful count; filter rail scrolls |
| Detail | world stage, game title, mastery ring, dominant Play, quiet favorites/records |
| Tutorial / intro | concise reveal shell; the demo is one concept at a time; retry controls reachable |
| Gameplay | mechanic-first board under a compact instrument strip; HUD pause reachable at every profile |
| Results (in-session) | one score presentation, honest band (“Keep training” at 0%), facts strip, reward separate from performance, clear actions |
| Results (route) | same artifact + persisted facts; weak band honest; primary action in-flow below the artifact |
| Progress | focal consistency/rating, honest empty and populated states, no dashboard clutter |
| Profile | identity-first (monogram, level, XP, streak, equipped cosmetics); records demoted |
| Rewards | collectible plates with owned/equipped/locked states; claim rows with visible keys |
| Dark | authored palette (ink canvas, re-authored world art, coral keys), not an inversion |
| font-scale-2 | layouts wrap/grow: HUD two-row, cards scroll, actions remain reachable; no collapse |
| compact | storefront/filters/grids intact; no unusable spacing |

## Defects found and repaired by this certification

| # | Defect | Evidence | Repair |
| --- | --- | --- | --- |
| 1 | HUD `Pause` overflowed the instrument strip and was clipped past the screen edge (off-screen at fs2; squeezed at compact; bleeding past the frame at default) | `defect-hud-pause-clipped-default.jpg`, `defect-hud-pause-offscreen-fs2.jpg`; hierarchy `[1054,217][1038,333]` | `SessionHeader` wraps; `GameButton` small variant sizes to content (`f95c5dd`) |
| 2 | Ten in-session results rendered a duplicate `Score` fact row printing the raw float (`Score 965.1614386889669`) beside the focal numeral | hierarchy + pixel capture of the Task Switch result | removed the redundant row; focal numeral remains (`53468e4`) |
| 3 | Tall tutorial demo steps clipped the `Try again` control to negative height (deduction table dead-ended after a wrong answer) | device reproduction `[105,2298][975,2274]`; fix verification `[105,2075][975,2201]` | `TutorialFrame` cap raised to the full overlay height (`34c9b2d`) |

Each repair invalidated the previous APK; all six matrices, the accessibility
audits and the runtime matrix above were re-executed on the final artifact
`99D1D132…0C55` from checkpoint `34c9b2d`.

## Runtime matrix on the final artifact (post-repair)

| Check | Result |
| --- | --- |
| Clean uninstall/install + first launch | PASS — install Success, Home `0/4` + `Start workout` |
| Warm launch / offline launch → restore | PASS — `home-title` and `home-local-trust` present offline |
| Route recovery (invalid / oversized game id, oversized Results id, malformed workout tuple) | PASS — recoverable “Unknown game … Browse games”, Results empty state, tutorial intro renders with the malformed tuple ignored |
| 8 domains at Game Detail | PASS — 8/8 title + Play |
| Tutorial + real gameplay + honest weak Result | PASS — memory demo [7,5,2] tapped for real; 0% session → “Keep training”, single score, neutral reward |
| Dark Games + Result | PASS — authored dark palette; honest band text |
| Full four-game workout | PASS — Task Switch → Context Fit → Deduction Table (retry reachable) → Order Sweep → **Finish workout** → Home “Workout complete / 4/4 games saved” |
| Relaunch retention | PASS — cold relaunch still “4/4 games saved” |
| SQLite audit | PASS — `integrity_check ok`, `foreign_key_check` 0 rows, schema v12, 5 sessions / 0 duplicate ids, 5 unique `gameplay:<sessionId>` ledger ops, 0 duplicate rating/domain rows, 1 workout instance `status=completed current_index=4` |
| Log review | PASS — 138,631 lines, 0 FATAL/ANR/SIGSEGV/OOM/SQLite/ReactNativeJS-error/RedBox |

## Adversarial certification review

- **APK identity:** the terminal artifact is `99D1D132…0C55` (109,595,521
  bytes) built from product checkpoint `34c9b2d`; the earlier `A83729AE…` and
  `2208174A…` artifacts were invalidated by real defect repairs, and the
  intermediate `B1B4D1D5…` build was superseded by the tutorial-frame repair.
- **Executable drift after certification:** none — only docs/OpenSpec/governance
  files change after the checkpoint (verified with `git diff --stat`).
- **Pixels:** 108/108 captures nonblank, composited, route-verified; two
  independent pixel validators (harness + PIL analysis) agree.
- **All six combinations captured:** yes, canonical and interaction sets.
- **fs2 primary actions:** HUD pause reachable, in-session result actions
  reachable, Home CTA visible, tutorial retry reachable.
- **Compact interaction/hierarchy:** intact; only the known hit-slop-compliant
  Progress tabs measure under 44 dp.
- **Dark mode:** authored palette with clear separation; not an inversion.
- **Results:** one score presentation, honest weak band, reward separate.
- **Games:** storefront + poster grid, not repeated giant cards.
- **Profile/Rewards:** identity-first / collectible, verified in both themes.
- **Source edits:** three real defects repaired; every repair was followed by a
  new checkpoint, a new APK, and a complete re-run of the six matrices and the
  runtime canaries on the new artifact.
- **OpenSpec / governance:** set to terminal VALIDATED in this session.
- **Non-target runtimes:** `emulator-5556` and every other runtime were never
  present or touched.
