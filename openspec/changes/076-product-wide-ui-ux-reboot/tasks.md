## 1. Old-build baseline and state inventory (must precede presentation edits)

- [x] 1.1 Inventory every player-facing route and its empty/loading/success/error/settings states; record owner, entry path and current viewport problem in a coverage manifest.
- [x] 1.2 Verify the dedicated AVD and external ARTEMIS `doctor`/supported Codex MCP; establish Flash smoke and Pro stateful journeys without host-input automation, or record the exact BLOCKED condition.
- [x] 1.3 Preserve old-release first-run, workout start/resume/completion, browse/search/filters/favorites, detail/tutorial, standalone Results, Progress, Rewards, Profile, data/restore and recovery captures with old SHA, APK hash, theme, route/state and device metadata; do not replace the existing 20 partial images.
- [x] 1.4 Capture old-build active board, feedback and result (plus pause/timeout/error when applicable) for the five Attention games in `design.md` before editing their modules.
- [x] 1.5 Capture the same old-build states for the five Flexibility games before editing them.
- [x] 1.6 Capture the same old-build states for the five Language games before editing them.
- [x] 1.7 Capture the same old-build states for the five Logic games before editing them.
- [x] 1.8 Capture the same old-build states for the five Math games before editing them.
- [x] 1.9 Capture the same old-build states for the seven Memory games before editing them.
- [x] 1.10 Capture the same old-build states for the five Spatial games before editing them.
- [x] 1.11 Capture the same old-build states for the five Speed games before editing them.
- [x] 1.12 Add old-build compact/large layout, dark 2× text and reduced-motion/accessibility samples; publish a before-state manifest with honest NOT VALIDATED entries for anything unreachable.

## 2. Three real design directions and decision

- [x] 2.1 Build a dev-only, on-device Pocket Console prototype of the shared seeded journey and Memory/Equation Builder boards with light/dark/large-text captures; preserve Playdate yellow-brand/violet-CTA roles.
- [x] 2.2 Build the identical dev-only Training Studio journey and board prototypes with matched captures; keep Peloton red for primary actions, not generic error color.
- [x] 2.3 Build the identical dev-only Puzzle Index journey and boards with matched captures; retain V–A–C monochrome, grid and square surface constraints while testing action clarity.
- [x] 2.4 Inspect all three prototypes on the emulator, complete the weighted usability/accessibility/distinctiveness scorecard, record rejected traits, and repeat a candidate if none passes.
- [x] 2.5 Publish the chosen reference lock with product-owned type, role-based color, surfaces, spacing, board media, action hierarchy, motion and light/dark rules; remove or dev-gate unused prototypes before shipping.

## 3. Shared compositional contract and canary journey

- [x] 3.1 Implement chosen semantic typography, accessible color-role pairs, layout tiers and motion/reduced-motion tokens without changing persistence/scoring rules; add focused tests.
- [x] 3.2 Implement reusable page shell, action placement, feedback/result and progress primitives with semantic labels/test IDs and 48dp Android/44pt iOS target checks.
- [x] 3.3 Redesign shared game intro/tutorial, session header, pause/quit, error and in-game results chrome while preserving SDK/session/workout ownership and authoritative save behavior.
- [x] 3.4 Make the Memory and Equation Builder canary boards mechanic-specific, usable at compact/2× sizes, and exercise correct/incorrect/timeout/result states on device.
- [x] 3.5 Validate the complete Home → discovery → detail → tutorial → game → feedback → persisted result → workout-next journey on old vs new build; fix any Critical/High regressions before expanding.

## 4. Core navigation, discovery and workout

- [x] 4.1 Redesign Home's first-run, today's workout and resume hierarchy with a visible primary action, readable stats and a compact-large-text path; capture matched after images.
- [x] 4.2 Redesign workout selection, detail, in-progress leg and completion presentation; verify persisted leg, XP and currency remain correct after background/return.
- [x] 4.3 Redesign Games' recommendation, complete library grid, search, filters, favorites and empty/reset states; confirm all 42 remain discoverable.
- [x] 4.4 Redesign game-detail preview, difficulty/launch and tutorial handoff with actual game media or intentional placeholders and a reachable Start action.
- [x] 4.5 Redesign standalone Results for weak/strong outcomes, persisted rewards, replay, workout next/completion and saving errors; exercise valid navigation.

## 5. Supporting routes and recovery

- [x] 5.1 Redesign Progress overview and detail/insight routes (empty, loading, populated and errors) and inspect the same data before/after.
- [x] 5.2 Redesign Rewards inbox, claimable/claimed/empty states and celebration; verify economy ledger outcomes are unchanged.
- [x] 5.3 Redesign Profile, settings and accessibility/sensory controls; verify state, restore and focus/large-text behavior.
- [x] 5.4 Redesign data management, backup/restore, storage unavailable, diagnostic and bootstrap recovery states without masking data-loss risk or changing data format.
- [x] 5.5 Inspect every other registered player-facing route/modal/confirmation and add matched before/after evidence; no unreviewed route silently passes.

## 6. Attention game modules (own only each named game's directory)

- [x] 6.1 Redesign and individually play/capture `attention-odd-one-out` active, feedback, pause/end states; retain its selection mechanic.
  **Re-checked 2026-10-10 with linked current-device evidence on the terminal APK `e243341f…`.** The earlier NOT VALIDATED classification is superseded: `openspec/changes/076-f-final-product-certification/evidence/current-device/attention-odd-one-out/review.md` captures active board, quoted feedback ("Found it!" / Score 125, and timeout reveal "Time's up"), pause/resume, final result and input responsiveness, and the odd-one-out selection mechanic is retained. Frames from `de6c5fcd…` remain historical and are not terminal-APK captures.
- [x] 6.2 Redesign and individually play/capture `attention-sustained-vigilance` states; retain its sustained-timing mechanic.
  **Re-checked 2026-10-10 with linked current-device evidence on the terminal APK `e243341f…`.** Evidence: `…/076-f…/current-device/attention-sustained-vigilance/review.md` (resource-id namespace `attention-sustained-vigilance.*`), quoted feedback, pause/resume, final result, and the sustained-timing mechanic retained. A contrast defect in the shared GO control is filed under 076-f task 4.1 and is not closed.
- [x] 6.3 Redesign and individually play/capture `attention-symbol-tracker` states; retain its tracking mechanic.
  **Re-checked 2026-10-10 with linked current-device evidence on the terminal APK `e243341f…`.** Evidence: `…/076-f…/current-device/attention-symbol-tracker/review.md`, quoted feedback, pause/resume, final result, tracking mechanic retained.
- [x] 6.4 Redesign and individually play/capture `attention-target-count` states; retain its counting mechanic.
- [x] 6.5 Redesign and individually play/capture `attention-visual-search` states; retain its search mechanic.
  **Re-checked 2026-10-10 with linked current-device evidence on the terminal APK `e243341f…`.** Evidence: `…/076-f…/current-device/attention-visual-search/review.md`, quoted feedback, pause/resume, final result, search mechanic retained.

## 7. Flexibility game modules

- [x] 7.1 Redesign and individually play/capture `flexibility-card-sort` active, feedback, pause/end states.
- [x] 7.2 Redesign and individually play/capture `flexibility-color-stroop` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `flexibility-color-stroop` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/flexibility-color-stroop/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 7.3 Redesign and individually play/capture `flexibility-cue-shift` states.
- [x] 7.4 Redesign and individually play/capture `flexibility-rule-flip` states.
- [x] 7.5 Redesign and individually play/capture `flexibility-task-switch` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `flexibility-task-switch` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/flexibility-task-switch/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.

## 8. Language game modules

- [x] 8.1 Redesign and individually play/capture `language-context-fit` active, feedback, pause/end states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `language-context-fit` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/language-context-fit/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 8.2 Redesign and individually play/capture `language-sentence-builder` states.
- [x] 8.3 Redesign and individually play/capture `language-word-chain` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `language-word-chain` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/language-word-chain/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 8.4 Redesign and individually play/capture `language-word-match` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `language-word-match` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/language-word-match/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 8.5 Redesign and individually play/capture `language-word-scramble` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  The full-state review lives in `openspec/changes/076-f-final-product-certification/evidence/current-device/language-word-scramble/review.md`, and the disabled action control of this row is one of the two
  surfaces the 076-f shared-Button repair repaints, so it was re-observed on the new terminal APK from the
  live board in both themes: `evidence/d3-affected-games-reobserved.json` measures fill
  #ECEAE5 / label #4A4B4E = 7.25:1 in light and #17181B / #B9BABC = 9.14:1 in dark, both above the 4.5:1 AA
  threshold and both equal to the design tokens the repair specifies, which rules out any remaining opacity
  compositing. All enabled controls and all behaviour are untouched, so the rest of the row still asserts the
  same states it did on the previous APK.

## 9. Logic game modules

- [x] 9.1 Redesign and individually play/capture `logic-code-cracker` active, feedback, pause/end states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  The full-state review lives in `openspec/changes/076-f-final-product-certification/evidence/current-device/logic-code-cracker/review.md`, and the disabled action control of this row is one of the two
  surfaces the 076-f shared-Button repair repaints, so it was re-observed on the new terminal APK from the
  live board in both themes: `evidence/d3-affected-games-reobserved.json` measures fill
  #ECEAE5 / label #4A4B4E = 7.25:1 in light and #17181B / #B9BABC = 9.14:1 in dark, both above the 4.5:1 AA
  threshold and both equal to the design tokens the repair specifies, which rules out any remaining opacity
  compositing. All enabled controls and all behaviour are untouched, so the rest of the row still asserts the
  same states it did on the previous APK.
- [x] 9.2 Redesign and individually play/capture `logic-deduction-table` states.
- [x] 9.3 Redesign and individually play/capture `logic-next-sequence` states.
- [x] 9.4 Redesign and individually play/capture `logic-order-path` states.
- [x] 9.5 Redesign and individually play/capture `logic-rule-grid` states.

## 10. Math game modules

- [x] 10.1 Redesign and individually play/capture `math-equation-builder` active, feedback, pause/end states (canary acceptance included).
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `math-equation-builder` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/math-equation-builder/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 10.2 Redesign and individually play/capture `math-fast-math` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `math-fast-math` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/math-fast-math/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 10.3 Redesign and individually play/capture `math-missing-operator` states.
- [x] 10.4 Redesign and individually play/capture `math-number-line-estimation` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `math-number-line-estimation` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/math-number-line-estimation/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 10.5 Redesign and individually play/capture `math-value-ordering` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `math-value-ordering` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/math-value-ordering/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.

## 11. Memory game modules

- [x] 11.1 Redesign and individually play/capture `memory` active, feedback, pause/end states (canary acceptance included).
- [x] 11.2 Redesign and individually play/capture `memory-grid-recall` states.
- [x] 11.3 Redesign and individually play/capture `memory-pair-recall` states.
- [x] 11.4 Redesign and individually play/capture `memory-pattern-tap-back` states.
- [x] 11.5 Redesign and individually play/capture `memory-prospective-cue` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `memory-prospective-cue` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/memory-prospective-cue/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 11.6 Redesign and individually play/capture `memory-running-order` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `memory-running-order` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/memory-running-order/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 11.7 Redesign and individually play/capture `memory-sequence-memory` states.

## 12. Spatial game modules

- [x] 12.1 Redesign and individually play/capture `spatial-coordinate-turn` active, feedback, pause/end states.
- [x] 12.2 Redesign and individually play/capture `spatial-fold-match` states.
- [x] 12.3 Redesign and individually play/capture `spatial-grid-nav` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `spatial-grid-nav` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/spatial-grid-nav/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 12.4 Redesign and individually play/capture `spatial-mental-rotation` states.
- [x] 12.5 Redesign and individually play/capture `spatial-transform-match` states.

## 13. Speed game modules

- [x] 13.1 Redesign and individually play/capture `speed-color-match` active, feedback, pause/end states.
- [x] 13.2 Redesign and individually play/capture `speed-order-sweep` states.
- [x] 13.3 Redesign and individually play/capture `speed-quick-compare` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `speed-quick-compare` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/speed-quick-compare/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.
- [x] 13.4 Redesign and individually play/capture `speed-reaction-time` states.
- [x] 13.5 Redesign and individually play/capture `speed-tap-rush` states.
  **Re-checked 2026-10-12 with the D3 fix on APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` (source `d5787ec2857b0fd856d2e04ad346316d70951f6c`).**
  `speed-tap-rush` still has a complete, identity-verified row on the terminal APK (`openspec/changes/076-f-final-product-certification/evidence/current-device/speed-tap-rush/review.md`):
  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,
  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3
  repair in `evidence/d3-impact.json` — a shared-Button disabled-colour change only, which touches no
  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it
  asserts. The two affected rows were re-observed separately and did not change this row's status.

## 14. Convergence, device certification and release

- [x] 14.1 Reconcile all eight game-domain patches centrally; shared theme/registries/navigation have one writer, no temporary worktrees or orphan branches, maintain a buildable `main`.
- [x] 14.2 Compare screenshots for 42/42 active boards and applicable feedback/result states on device, with legibility, distinct mechanics, labels/touch and action placement recorded individually.
  **Re-checked 2026-10-12 with linked current-device evidence on the terminal APK `e243341f…`.** All 42 games were played on the recovered dedicated device and each row files its own device frame (`result.png` + `result.xml`) with: the active board described per game, quoted scored feedback, pause/resume, the itemised final result, legibility and action-placement notes, and a defects section. Distinct mechanics are individually confirmed retained per row rather than asserted in bulk. Labels and touch targets were then measured separately over 126 surfaces / 756 controls with 0 violations. The earlier NOT VALIDATED classification is superseded. Evidence: `openspec/changes/076-f-final-product-certification/evidence/current-device/<game>/review.md` (42 rows).
- [ ] 14.3 Review matched route and representative game before/after matrices for default light/dark, dark/light 2× text, compact/large layouts and reduced-motion, correcting clipping, low contrast or hidden actions.
  **Still OPEN — evidence-integrity correction 2026-10-13. Original criteria unchanged.**
  The earlier 62 theme-verified pairs and 38 theme-mismatched results were based on
  mean luminance; those classifications are withdrawn. No committed hash-linked
  observed app-theme witness exists in these inventories. Requested capture modes
  and directory names are not observed theme; uncertain frames are UNKNOWN.

  The refreshed `evidence/coverage-matrix.json` has 216 rows:
  0 MATCHED, 100 THEME-UNKNOWN, 112 AFTER-ONLY, 4 BEFORE-SURFACE-DIFFERS.
  The 20 route, 42 tutorial and 38 standalone-result candidates retain their hashes/identities but cannot count as comparisons.
  Four games have only a different workout-leg before surface; no equivalence is fabricated.

  | Condition | Confirmed matches | Remaining evidence |
  | --- | --- | --- |
  | default light/dark | 0 | 16 route candidates with UNKNOWN themes; 14 after-only slots |
  | dark/light 2x text | 0 | 4 route candidates with UNKNOWN themes; 26 after-only slots |
  | compact/large | 0 | 30 after-only route slots; no historical before profile |
  | reduced-motion | 0 | no before/after screenshot profile; existing measurement only |

  466 PNGs (272 historical states, 20 historical routes, 90 matrix routes and
  84 existing tutorials) were checked against their original recorded hashes/bytes.
  The theme inventory additionally includes 42 filed result rows with computed
  hashes, not claimed prior-digest verification: 508 frames, observed themes UNKNOWN.
  Hash integrity does not establish state, theme or acceptance. Existing after-only
  accessibility measurements remain historical and were not recertified.

  Full detail and exact slots: `evidence/VISUAL_DECISION.md`.
  Before a limited Android beta the owner must authorize resolving this evidence
  debt or explicitly accept it for that beta. No waiver or release-verdict change
  is inferred. No production edits, local/historical APK rebuild, new captures,
  ARTEMIS calls, 42-game sweep or nine-journey certification occurred in this cleanup.

- [x] 14.4 Run ARTEMIS Flash smoke and Pro first-run, daily workout, resume, game result, workout completion, diagnostic and error-recovery journeys; inspect traces and fix Critical/High findings.
  **Checked 2026-10-12/13 with linked controller evidence.** All nine stateful journeys were executed and inspected through the authorised ARTEMIS controller (never ADB gameplay) on the dedicated device `emulator-5570`, each filed under `openspec/changes/076-f-final-product-certification/evidence/journeys/<key>/journey.md` with its session trace ID, planned steps, executed steps and quoted observed outcome: first-run onboarding `53f77102-…`, daily workout `ae7e82fe-…`, scored gameplay `4b95be7a-…`, interrupted resume `c9df15ae-…` (quoting the pre-background anchor and the identical post-resume state, proving state preservation), standalone completion `002bc9d8-…`, full workout completion `2b30a3ef-…`, results and progress `dae4edc0-…`, diagnostics/storage recovery `bb4b414d-…`, background/foreground interruption `47b1921c-…` — **9/9 PASS**. Flash and Pro authenticated smokes both PASS (`6f185691-…`, `251e3f10-…`). Tabulated in `evidence/JOURNEYS.md`. **Critical/High finding repaired:** the one reproduced defect (D3, the disabled shared-`Button` label collapse) was fixed with a regression guard and re-verified on the rebuilt terminal APK — see 076-f task 4.1. The journeys assert scored feedback, pause/resume, results and navigation, none of which is a disabled-control colour, so they remain valid on the new APK; the D3 fix changed no behaviour they exercise.
- [x] 14.5 Run required impact-map checks, type/lint/tests and release APK build/install/start; verify unchanged scoring, version metadata, progression, persistence, backup/restore and offline behavior.
- [x] 14.6 Check iOS layout/runtime independently if available; mark PASS, NOT VALIDATED or BLOCKED with concrete evidence, never infer PASS from Android.
- [x] 14.7 Publish final scrubbed coverage manifest and visual decision report: per-game/route status, 3-direction scorecard/reference lock, matched images, APK SHA, residual debt and explicit NOT VALIDATED/BLOCKED gaps. Do not claim completion with any game missing.
  **Remains checked — publication corrected 2026-10-13 without claiming acceptance.**
  Coverage status: `evidence/coverage-matrix.json` (216 rows); visual report:
  `evidence/VISUAL_DECISION.md`; image references: `evidence/matched-gallery.json` and `evidence/matched-image-index.md`.
  The old 62-pair claim is withdrawn; the matched index now has 0 confirmed pairs.
  Unknown candidates, after-only slots and different before surfaces remain explicit.
  All 42 games retain a result status and filed review; no missing comparison is fabricated.
  The three-direction decision record remains `evidence/proto-scorecard.md` (A 8.45, B 8.63, C 7.63), with `evidence/REFERENCE_LOCK.md`.
  Historical baseline, route matrix, repaired-terminal tutorial and per-game APK
  identities remain separate and unchanged. Residual debt: report, 076-f
  `evidence/DEFECTS_CURRENT.md` and `evidence/VERDICT.md`.
  Publication does not close 14.3; verdict remains `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`.

- [x] 14.8 Update durable `.agent/` campaign/state/validation/issues at meaningful checkpoints, commit and push coherent buildable work to `origin/main`, and verify no abandoned worktrees.
  **Re-checked 2026-10-12.** `.agent/STATE.md` carries dated correction #6 as the current state with all earlier corrections preserved explicitly as history rather than deleted. Durable evidence was updated at every meaningful checkpoint this campaign: `STATE.md`, `CURRENT_CAMPAIGN.md`, `evidence/DEVICE_RECOVERY.md`, `VERDICT.md`, `JOURNEYS.md`, `ROUTES_AND_A11Y.md`, `PROVENANCE.md`, `REVIEW_TERMINAL.md` and both task ledgers. Work is committed and pushed to `origin/main` at `24cb91d`. Verified clean: one worktree (`D:/Documents/tryPython/brain-training` at `main`), one local branch, no orphan branches and no untracked drift at checkpoint.
