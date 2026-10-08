# Campaign 076 evidence index (release acceptance BLOCKED)

Read **`CLOSURE_CHECKPOINT.md` first** for 2026-10-08 current scope.

- Source `c324960`, APK `de6c5fcd…`: `final-matrix-de6c5fcd/captures.json`
  (90 reviewed route pairs, six reproducible audits),
  `final-scroll-de6c5fcd/captures.json` (2 reviewed Results reachability pairs).
  Verify each using `verify-capture-evidence.mjs --manifest <path>`; after
  commit add `--require-committed`. Raw window XML hashes are preserved as
  `.windows.txt`; audits measure unique app XMLs only.
- Historical game index is now 194 retained/16 rejected, 168/168 complete;
  the verifier `--require-complete` PASSES for historical coverage. It does
  not certify this APK. All 22 current-build gap states still owed.
- ~~Current Pro failed HTTP 401 Invalid credential (no plan/steps):
  **BLOCKED_EXTERNAL_ARTEMIS_PROVIDER**. Owner external credential action
  required. No controller fallback or more retries.~~ **Stale — corrected
  2026-10-08 by 076-f task 1.1.** The credential is no longer invalid; the
  re-probe failure class is provider **quota exhaustion** (HTTP 429
  `RESOURCE_EXHAUSTED`, `generate_content_free_tier_requests`, limit 20/day per
  model). The controller is operational once routed to a model with quota — see
  `openspec/changes/076-f-final-product-certification/evidence/CONTROLLER.md`.
  This correction is not release acceptance. iOS BUILD PASS /
  RUNTIME NOT VALIDATED. Campaign still ACTIVE; no terminal verdict.

## Former review index snapshot — historical, counts superseded

The text below describes an earlier review only. Read historical
`GAME_ASSESSMENT.md` and `WAVE14_EVIDENCE.md` with their current-scope notices. The corrected
`after-captures-games/index.json` retains 172 SHA-256-pinned screenshots;
16 misleading captures are quarantined in `after-captures-games/rejected/`
with explicit reasons. Only 146/168 per-game A/F/P/R states depict their
claimed state. The 90/90 app-owned route matrix in
`after-captures-matrix-00024954/` belongs to APK `00024954…` and is not
final-build acceptance. The later `after-board-stills-c3b3e4d9/` contains
8/8 valid focused light/dark detail pairs for APK `c3b3e4d9…`, not a full
matrix. Both manifests and per-file PNG/XML hashes can be checked via
`node scripts/qa/verify-capture-evidence.mjs --manifest <path>`; after a
commit use `--require-committed` for provenance. Game index hashes,
quarantined PNGs and the exact 22 missing states are reproducible with
`node scripts/qa/verify-game-evidence.mjs --index openspec/changes/076-product-wide-ui-ux-reboot/evidence/after-captures-games/index.json`.
`--require-complete` intentionally fails until all 168 per-game states
have genuine frames; `--require-committed` checks Git identity, not visuals. The final-build full-matrix
attempt aborted on launcher/SystemUI ANRs and remains outside Git.
ARTEMIS Pro is provider-BLOCKED; iOS NOT VALIDATED. Historical capture names
and old wave PASS tables cannot supersede these release boundaries.

## Explore-stage device baseline (partial; not a certification)

Source `d3d0b9926a44c039d7fd0d29e1376586afaa897b`, installed release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9`, dedicated Android emulator `braintraining-ui35` (`emulator-5554`, 1080×2400 px), app `com.braintraining.app`. `before/index.json` hashes all 20 preserved screenshots. Original per-screen accessibility XML and the most recent capture manifest remain locally in ignored `qa-artifacts/ui-reboot/before-d3d0b99/`; the capture script overwrote the root manifest during the font-scale-2 pass, so default-theme route-verification metadata is **not** preserved here. Do not treat default-theme route verification as an automated PASS.

| Profile | Light | Dark | What was captured |
| --- | --- | --- | --- |
| Default | 8 screenshots | 8 screenshots | Home, Games, game detail, Memory intro, Progress, Rewards, Profile, data management |
| 2× font scale | 4 screenshots | 0 | Home, Memory intro, Progress, Profile |

Visual observations after opening the PNGs: Home's decorative hero/workout block dominates the first viewport; Games' recommended-game hero pushes library discovery downward; game intro pairs an oversized art stage with an instructional sheet, making Start hard to see in the first viewport. At 2× text, Home's first-run primary action falls below the initial viewport, and the intro remains tall; scrolling is available but discoverability requires redesign. Dark mode is largely a palette inversion of the same composition. These are observations of **these** screens, not a review of gameplay or of every route.

**Missing before evidence:** every active board, answer feedback, pause/resume, timeouts, game result, standalone Results, workout completion, search/empty states, storage error/restore and remaining route states; seven other domains; compact/tablet sizes, dark 2× text, iOS. Capture these against the still-available pre-change APK and SHA before modifying each affected presentation. If a required state proves unreachable, report NOT VALIDATED with a cause; never synthesize a before screenshot from new code. ARTEMIS runtime journeys were not run at this Explore stage. Historical redesign certificates are not visual acceptance for this change.
