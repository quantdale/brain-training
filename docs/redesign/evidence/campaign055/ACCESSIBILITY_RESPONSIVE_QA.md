# Campaign 055 — Accessibility & Responsive QA

## Scope executed

- Repository gates: `themed-text.a11y`, `shell-a11y`, `shell-a11y-source`,
  `app-tabs.a11y`, kit contract tests — all green in the full 565-suite run.
- Native compact/light matrix captured on the final artifact
  (`9E6B94FC…367A`) through `scripts/qa/ui-capture.mjs --profile compact`
  (720×1600 @ 320 dpi = 360×800 dp): 11/11 surfaces with uiautomator dumps.
- Native default light/dark and the interaction states (tutorial, gameplay,
  in-session result, Home active and completed, Games/rewards scrolled) were
  captured on the same artifact; see `BEFORE_AFTER_REVIEW.md`.

## Automated audit result (compact/light, 11 surfaces)

`node scripts/qa/a11y-audit.mjs --dir qa-artifacts/campaign055-after` :

- **0 unlabelled interactive nodes.**
- **0 decorative-art leaks** (world art and collectible objects stay hidden
  from the a11y tree).
- **27 measured `target<44dp` observations.** None are unlabelled, and no
  screen-reader semantic was lost. Grouped by cause:

| Cause | Nodes | Measured | Assessment |
| --- | --- | --- | --- |
| Primary key with the 4 dp console lip (`Play Memory`, `Start game`, `See today's progress`, `Open game details`) | 4 | 43 dp | The control lays out at 48 dp; uiautomator reports the visible face above the lip. Effectively compliant; the kit test still asserts `minHeight + hitSlop ≥ 44`. |
| Pre-existing text-style controls: back controls (`Go back`, `Back to Games`), `How to play` ghost, `Add to favorites` | 8 | 34–37 dp | Same shared `BackLink`/`ScreenHeader`/ghost-button pattern present before this campaign; hit targets are extended by hitSlop. |
| Difficulty selector keys (`Easy`…`Adaptive`) in the GameHost intro | 5 | 34–37 dp | Pre-existing `DifficultySelector`; not changed by this campaign. |
| Progress window segmented control (`7d/30d/90d/All`) | 4 | 24 dp | Pre-existing `SegmentedControl` tab nodes (hitSlop extends the target). |
| Reward claim keys (`Claim`) and `Buy Freeze/Shield` | 5 | 34 dp | Existing compact-size action keys inside hairline reward rows. |
| Profile equipped-cosmetics entry | 1 | 40 dp | New row; `ReportRow` enforces `minHeight: 44` but the measured visible box is the child content (the row's own bounds are 44). |

## Honest classification

- **Compact/light: CAPTURED WITH FINDINGS.** The 44 dp contract is met by
  layout (`ReportRow`/`Chip`/kit assertions) and no node lost its label, but
  the visible-bounds measurement on several compact controls sits below 44 dp.
  This matches the Campaign 026/049 treatment of visible-edge clipping, but
  because a subset of the surfaces was re-composed in this campaign it is
  **not** claimed as zero-violation.
- **Compact dark, font-scale-2, expanded, landscape: NOT VALIDATED** — the
  host emulator crashed during the profile switch and could not be restarted
  (see `FINAL_NATIVE_VALIDATION.md`, environment blocker). Campaign 049's
  terminal font-scale-2/compact matrix remains historical evidence for the
  unchanged contracts; the re-composed surfaces still need a re-run.
- **Human TalkBack/VoiceOver quality: NOT VALIDATED** (manual boundary,
  unchanged).

## Follow-up for the resumed native pass

1. Re-run `ui-capture` with `--profile compact --theme dark`, `--profile
   font-scale-2`, and the default light/dark matrix.
2. Triage the 27 compact findings: if the 34–37 dp nodes are truly clipped
   visible edges, classify them as `clipped`; if any are undersized, raise
   their `minHeight`/`hitSlop` in the shared control and re-audit.
3. Re-check `results` and `rewards` action hierarchy under font scale 2
   (the Campaign 042 large-text CTA regression class).
