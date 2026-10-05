# Wave 3 evidence — shared contract + canary journey (tasks 3.1–3.5)

**Build:** release APK from the wave-3 tree (final canary build SHA-256 prefix
`9e61db2e14bd5a43`), installed on `braintraining-ui35` / `emulator-5554`.
**Old-build baseline:** `before-captures/` (272 images, APK `d631ab9a…`).

## 3.1 — Locked tokens implemented

- `theme/tokens.ts` re-authored to the Training-Studio lock (values only; the
  token SHAPE is unchanged so 200+ consumers keep compiling): studio neutrals
  (`#F7F6F3`/`#FFFFFF` light, `#101114`/`#1B1D21` dark), CTA-red accent family
  (`#D6293A`/`#FF4A57`), stage/stageInk pair, success/danger per lock,
  800-weight type hierarchy with `numeralXl` 54, quiet elevation ramp.
- `theme/stage` + `theme/stageInk` added to the neutral theme (the immersive
  panel exists in both schemes).
- Focused tests: `theme/__tests__/reference-lock.test.ts` (neutrals, CTA role
  discipline, success/danger distinct from red, weight cap, quiet elevation);
  the pre-existing `contrast.test.ts` verifies every pairing at WCAG-AA in
  both schemes (24/24 theme tests pass).
- `docs/DESIGN_SYSTEM.md` re-synced (071 contract test green).
- Visual snapshot baselines regenerated; verified diffs are exactly the
  intended token changes. Full jest matrix: 615 suites / 7,208 tests / 0
  failures.

## 3.2 — Shared primitives

- `Card` gains the `stage` variant: charcoal panel, white reading type, 1.5px
  border instead of shadow, raised elevation — in both schemes. Focused
  contract test `card-stage.test.tsx` (light + dark).
- Kit surfaces remain token-driven; the Button `secondary` variant changed
  from red-tinted fill to **bordered neutral** (lock section 5) so secondary
  actions stop reading as CTA-adjacent.

## 3.3 — In-game chrome

- **Session stage panel**: the in-session view now lives on the immersive
  charcoal panel (`theme.stage`) in both schemes; the instrument strip renders
  in stage presentation (`SessionHeader onStage`); the game's board keeps its
  own light surface card inside the panel — all 42 games inherit the frame
  without per-game edits.
- **Result artifact**: the in-session result is the staged artifact (charcoal
  panel, `stageInk` headline, played board as the still) — matches the
  prototype acceptance.
- Pause overlay: unchanged opaque contract (SDK `createPauseOverlaySpec`);
  202 game-host tests pass.

## 3.4 — Canary boards (device-verified, light + dark)

| Canary | State | Evidence |
| --- | --- | --- |
| Memory | active board on stage panel; revealed flash in the **memory domain hue** (not CTA red); round chip staged; pause overlay; in-round feedback; weak-run result artifact | `after-captures-wave3/after-memory-*.png` |
| Equation Builder | active board; number keys as neutral tokens (red CTA role reserved for Submit); staged round chip + timer; Submit feedback; **round-timeout state** ("Time's up!" + Next round); result artifact | `after-math-equation-builder-*.png` incl. `-timeout` |
| 2× / compact | covered by the fs2 prototype captures + the wave-14 full matrix | `proto-*-fs2.png` |

Repairs found BY the canary exercise (fixed in this wave):

1. Memory revealed-tile flash used the CTA red — now the memory domain hue
   (red-role discipline).
2. Button secondary was red-tinted — now bordered neutral.
3. Equation Builder number keys rendered as red primary buttons — now neutral
   tokens.
4. Game-supplied round chips rendered dark ink on the charcoal strip — Memory
   and Equation Builder chips now read in `stageInk`.

## 3.5 — Full journey on the new build (old-vs-new comparison)

- Journey executed on the release build: Home (1/4 Continue workout) → leg 2
  Word Chain (intro → tutorial → weak play → staged result) → Next game →
  leg 3 Cue Shift → leg 4 Attention Target Count → **Finish workout** → Home
  "Workout complete · 4/4 games saved". Captures: `after-workout-*.png`,
  `after-home-workout-*.png`.
- **SQLite audit after the journey** (device db, `adb root` + sqlite3):
  `integrity_check ok`, schema `user_version 13`, `foreign_key_check` 0 rows,
  2 workout instances both `completed/current_index 4`, 51 game_sessions =
  51 `gameplay` ledger rows (exactly-once economy), 101 rating-history rows
  with **0 duplicate (session_id, domain)** pairs.
- **Log review**: 0 `FATAL EXCEPTION` / 0 `ANR in com.braintraining` entries
  across the session.
- Old-vs-new: the matched before captures live in `before-captures/` (same
  routes/states on APK `d631ab9a…`); the after set grows through waves 4–5 and
  the final matrices run in 14.2/14.3.

## Honest boundaries

- The route-level after matrix (all 17 routes × themes × profiles) is the
  14.2/14.3 deliverable; wave 3 captured the journey + canary states.
- ARTEMIS journeys run at 14.4 against the converged build.
- The workout-leg "Next game" tap needed a verified-retry (entrance
  animation race) — driver-side robustness, not a product defect; recorded
  for the 14.x automation notes.
