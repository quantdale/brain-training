# Campaign 055 — Signal Arcade Desirability Pass (Closure)

**Verdict: `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`**
**Repository baseline:** `698bfd3` (synchronized `main`; product baseline
`f59c066`).
**Implementation head:** the campaign commit history on `main` (planning →
shared system → surfaces → convergence).
**Runtime artifact:** `9E6B94FC…367A` (captures) / frozen-tree rebuild
`E1E9C4BD…D414`.

## Why PARTIAL

Every RETHINK/REFINE surface was materially improved and evidenced with
before/after pixels on the release artifact, and the repository matrix is
green. The campaign is not marked COMPLETE because the mandated final native
matrix could not be finished: the host emulator failed irrecoverably mid-pass
(access-violation crash loop, wedged guests; recovery needs a host reboot).
The checks recorded as NOT VALIDATED are compact/dark + font-scale-2 native
matrices, runtime recovery/log review on the frozen tree, the four-game workout
on the final artifact, and the post-fix SQLite duplicate audit. These are
environment gaps, not product defects, and are fully enumerated in
`FINAL_NATIVE_VALIDATION.md`.

## What landed

1. **Refinement contract** (`REFINEMENT_LOCK.md`) and targeted Refero research
   (`TARGETED_REFERO_RESEARCH.md`) before implementation.
2. **Shared visual system**: Stage/Panel/Report/Slot roles; typography voices
   (`gameTitle`, `resultHeadline`, `bodyRead`); shape and colour semantics;
   honest result bands and reward rows (`components/ui/arcade-panel.tsx`,
   `report.tsx`, `components/rewards/collectible-tile.tsx`,
   `components/discovery/game-stage.tsx`, `game-poster-tile.tsx`).
3. **Games**: storefront composition (featured stage + 2-up poster grid +
   single filter rail); internal rating removed from the reason line.
4. **Results**: one artifact, honest performance bands, no false success,
   factual reward rows, one primary action (in-session and route).
5. **Profile**: player identity first; records/settings in hairline reports;
   placeholder language removed.
6. **Rewards**: code-native collectible grids with owned/equipped/locked states.
7. **Home**: one dominant daily artifact; legs and stats in reports.
8. **Game Detail**: world-stage hero with Play dominance; records secondary.
9. **Tutorial/Gameplay**: compact tutorial shell and instrument-strip header;
   no mechanic change.
10. **Progress**: consistency rail + focal rating ring; administrative copy
    removed; every figure unchanged.
11. **Copy audit** implemented (`COPY_AND_LABEL_AUDIT.md`) including rounding
    the two games that printed unrounded milliseconds.
12. **Three critique passes** executed and their fixes applied
    (`VISUAL_CRITIQUE.md`).

## Evidence index (`docs/redesign/evidence/campaign055/`)

- `CAMPAIGN055_CLOSURE.md` (this file)
- `CURRENT_BASELINE.md`
- `TARGETED_REFERO_RESEARCH.md`
- `REFINEMENT_LOCK.md`
- `SURFACE_CHANGE_MATRIX.md`
- `COPY_AND_LABEL_AUDIT.md`
- `VISUAL_CRITIQUE.md`
- `BEFORE_AFTER_REVIEW.md`
- `ACCESSIBILITY_RESPONSIVE_QA.md`
- `PERFORMANCE_SANITY.md`
- `FINAL_REPOSITORY_VALIDATION.md`
- `FINAL_NATIVE_VALIDATION.md`
- `contact-sheet-before.jpg`, `contact-sheet-after.jpg`
- `screens/before/*`, `screens/after/*`
- No production art assets were introduced, so no `ASSET_MANIFEST.md` is
  needed; image generation was not available in this session and code-native
  systems were used instead.

## Final matrix summary

- Full gated Jest: **565 suites passed / 6,731 tests passed** (4 suites /
  5 tests opt-in skips; 5 snapshots; 0 unexpected console output).
- Typecheck, lint (0 warnings after convergence), repo-state, task ownership,
  affected-map sync, registry, provenance, offline, secrets, workflows,
  dependency audit, runtime-QA contract, Expo Doctor 21/21, OpenSpec strict
  39/39, web export, Android debug and release builds: **PASS**.
- Opt-in probes: 5/5 executed and passing.

## Remaining work for the resumed native pass

1. Reboot the host to restore the emulator/Hypervisor Platform.
2. Reinstall `app-release.apk` and re-run: default/compact/font-scale-2,
   light/dark `ui-capture`; invalid-route, offline, force-stop/relaunch,
   logcat review; SQLite integrity/duplicate audit; a full four-game workout.
3. Triage the 27 compact `target<44dp` observations
   (`ACCESSIBILITY_RESPONSIVE_QA.md`).
4. Adopt the `normalizedResult` band prop in the remaining games' results
   children and remove their duplicate `Score`/`Final score` rows
   (`VISUAL_CRITIQUE.md` remaining debt).

---

# Resumption addendum (2026-09-20)

**Resumption verdict: `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL` (unchanged).**

The resumption synchronized `main` (starting SHA
`90169bf73a6d848f21c4b8d7419fc2ac67a0cf7d` → prompt commit `18b7851…`), closed
the bounded result-system debt across the 42-game catalog, re-classified the 27
compact touch-target observations, refined the remaining Progress drill-down
copy, investigated the gameplay dead-space question, and executed the
repository matrix and the semantic native pass on one exact final artifact.

## Closed in this resumption

1. **Result duplication 42/42** — registry-derived inventory; the redundant
   `Score` fact row was removed in the 27 games that also render the focal
   `Final score` numeral; 15 single-presentation games untouched; no unique
   metric lost (`RESULT_DUPLICATION_CLOSURE.md`).
2. **Honest performance bands 42/42** — every game now passes its canonical
   normalized result to the shared results chrome; 0 legitimate non-adopters;
   no invented normalization (`NORMALIZED_RESULT_ADOPTION.md`). Verified on the
   final artifact: a 0-score session renders "Keep training" with a neutral
   factual reward row and no personal-best badge.
3. **27/27 compact target classification** — the 27 observations were an audit
   density artifact (420 default against 320-dpi compact captures); correct
   re-measurement leaves 4 Progress tabs that expand to 44 dp through the
   shared `Tappable` hit-slop contract. **0 TRUE_UNDERSIZED_TARGET**
   (`ACCESSIBILITY_RESPONSIVE_QA.md`).
4. **Progress drill-down copy** — nine shared `explainMetric` captions rewritten
   in player language; no figure or analytical semantic changed
   (`COPY_AND_LABEL_AUDIT.md`).
5. **Gameplay dead space** — classified Class B (game-owned board geometry);
   no shared layout defect, no board stretching, no mechanic retuning
   (`VISUAL_CRITIQUE.md`).
6. **Repository matrix on the frozen source** — full Jest 565/6,731, 5 probes,
   typecheck, lint, Expo Doctor 21/21, OpenSpec strict 39/39, all validators,
   web export, debug + release builds (`FINAL_REPOSITORY_VALIDATION.md`).
7. **Native semantic closure on the exact final artifact**
   (`A83729AE…48AA5`, 109,596,169 bytes, from checkpoint `ddfe539…`): clean
   install/first launch, warm/offline launches, invalid/oversized/malformed
   route recovery, Home ready/completed, Games + search/filter, 8 games across
   8 domains at Detail, real tutorial/gameplay interaction, weak Result, dark
   Games/Result, a full four-game workout with Next/Next/Next/Finish, relaunch
   retention, a clean SQLite audit (integrity ok, schema v12, zero duplicate
   session/ledger/rating ids, workout `completed`) and a clean log review
   (0 fatal/ANR/OOM/SQLite/RedBox) (`FINAL_NATIVE_VALIDATION.md`).

## Why still PARTIAL

The one mandatory closure lane that remains `NOT VALIDATED` is the **pixel
matrix**: default/compact/font-scale-2 × light/dark screenshots and the
pixel-level before/after comparison on the final artifact. The host's emulator
display/compositing path produces no composited frames in every GPU mode
(`UpdateLayeredWindowIndirect failed … A device attached to the system is not
functioning`; `dumpsys gfxinfo` = 0 frames), the canonical `ui-capture` harness
reports every capture `BLANK`, and `braintraining-ui35` (the AVD that produced
the first session's captures) now crashes with `0xC0000005` on every launch.
The guest itself is healthy — views, database, input, logs and every semantic
check work on the exact final artifact — so this is an environment blocker, not
a product defect (`RESUMPTION_ENVIRONMENT_RECOVERY.md`).

The historical first-session emulator-crash episode is preserved above as
historical truth; this resumption records the successful recovery of a
dedicated runtime, the completed semantic closure, and the remaining
host-display blocker separately.

---

# Pixel certification addendum (2026-09-20, later session)

**Terminal verdict: `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`.**

Starting SHA `0de77dc` (prompt commit fast-forwarded from `origin/main`). The
host display path was recovered by using the dedicated `braintraining-ui35`
AVD with the emulator's valid `-gpu host` mode (the earlier failure used the
legacy `-gpu swiftshader_indirect` value, which emulator 37.1.11 no longer
accepts, and the `aosp_atd` fallback image which cannot composite app frames).
The full environment proof is in `PIXEL_CERT_ENVIRONMENT.md`.

The six-way matrix then exposed **three genuine product defects** that no
semantic pass could see, each repaired with the smallest fix and followed by a
fresh checkpoint, a fresh release APK and a complete re-certification:

1. **HUD pause clipping** — the in-session instrument strip is a single
   non-wrapping row; the trailing `Pause` control overflowed the strip and was
   clipped past the screen edge (off-screen at font-scale-2, squeezed at
   compact, already bleeding past the frame at default). Fixed by letting the
   strip wrap and by sizing the small `GameButton` to its content
   (`f95c5dd`).
2. **Duplicate unrounded score** — ten games rendered a `Score` fact row
   printing the raw float (`Score 965.1614386889669`) beside the focal
   numeral; the resumption's duplication inventory had missed the animated
   numeral in those games. Fixed by removing the redundant row (`53468e4`).
3. **Tutorial retry unreachable** — tall demo steps (deduction table) clipped
   the `Try again` control to negative height after a wrong answer, dead-ending
   the tutorial. Fixed by raising the `TutorialFrame` height cap to the full
   overlay height (`34c9b2d`).

The terminal artifact is the release APK SHA-256
`99D1D132FD21E4A49D46EF10997305D62949291B1771F755E7B010200C990C55`
(109,595,521 bytes) built from product checkpoint `34c9b2d`.
`PIXEL_CERT_MATRIX.md` records the 66/66 canonical captures, the 42/42
interaction captures, the accessibility classification, the visual review, the
runtime matrix (including the full four-game workout, SQLite audit and log
review) and the adversarial review. `PIXEL_CERT_ENVIRONMENT.md` records the
runtime recovery and the composited-frame proof.
