# Executive report — Campaign 080

Campaign: `080-native-product-quality` — native product-quality, gameplay
acceptance, performance optimization, accessibility & release convergence.
Prepared 2026-10-21. Owner-authorized bounded successor to Campaign 079
(CONDITIONAL GO).

---

## Revisions

- **Starting SHA:** `f8ae95dde236ce04eb9d7308cf2186b6e68f2905` (= `origin/main`,
  all four hosted workflows green — independently re-verified).
- **Activation SHA:** `105ff23b` (governance + OpenSpec, no app source).
- **Ending / final integrated SHA:** recorded in `handoff.md` and
  `.agent/STATE.md` after integration (see `governance.md` H1 on self-reference).
- **Application source changed this campaign:** **NONE.** All changes are
  QA harness scripts, certification docs, OpenSpec/governance state. Game
  mechanics, scoring, persistence, routes, and economy are untouched.

## Scope completed

- **Workstream A (native 42-game coverage) — DELIVERED (flagship).** Enumerated
  the live 42-game registry and produced a fresh **native runtime** coverage
  matrix. Built a deterministic emulator-local sweep harness that fixes the
  Campaign 079 automation bottleneck (deep-link entry + stable `gameId.control`
  semantic ids + pre-captured hierarchy + out-of-band screenshots + nested-control
  matching). Result: **all 42 games at ≥ Level 1 (native smoke), 38 at Level 2
  (native interaction), 1 at Level 3 (full lifecycle)** — vs Campaign 079's single
  natively-journeyed game. Machine-readable ledger + human matrix delivered.
- **Workstream B (critical journeys) — DELIVERED (core).** Pause/Resume/Quit
  verified (timer freeze, resume, quit-discard); correct/incorrect scoring
  verified with genuine inputs + deterministic source tests; offline airplane-mode
  journey verified end-to-end; results/progression verified. Workout V3 full
  native lifecycle and duplicate-reward re-verification recorded as gaps.
- **Workstream C (performance) — DELIVERED (evidence-based).** Controlled source
  benchmarks + on-device frame measurements; emulator/software-rendering overhead
  separated from app cost (GPU percentiles, legacy-vs-modern jank split). No
  confirmed application-controlled frame bottleneck cleared the bar for a safe
  correction, so no optimization is falsely claimed; measurements + precise
  explanation provided per the mandate. Large-backup export heap (96 MB) recorded
  as a known tradeoff.
- **Workstream D/E (visual/accessibility) — ASSESSED.** Documented P3s reassessed
  and dispositioned; semantic a11y labels verified rich + stable (odd-item label
  is a positive accommodation); default-profile layout verified across 42 games.
  Corrections deferred (prioritization) with items queued.
- **Workstream F (persistence/offline) — DELIVERED (core).** Data preserved;
  session/progression durability + offline verified; backup/restore + migration
  recorded as source-covered gaps.
- **Workstream G (platform) — HONEST.** Separated platform statuses; Android
  emulator runtime broad-validated (x86_64); ARM64, physical Android/iOS, iOS
  simulator/physical runtime all **NOT VALIDATED** and not claimed.
- **Workstream H (governance) — DELIVERED.** Final-SHA reconciliation (app source
  unchanged 9c4dd138→f8ae95dd, so 079 runtime evidence carries forward);
  administrator-bypass posture reviewed and documented with the precise tradeoff
  and a non-bypass recommendation (owner decision); stale-language correction.
- **Workstream I (regression/integration) — IN PROGRESS at report time.** Full
  gate convergence + independent review + final integration.

## Defects fixed

- **Governance-consistency regression (introduced & fixed in-campaign):** the
  campaign activation initially wrote STATE.md's active-campaign field in a
  non-canonical format; the `frontier-audit` terminal-durable-state gate caught
  it and it was corrected to the canonical backticked form (17/17 green).
- No application P0/P1/P2 defect was confirmed in the exercised scope. The live
  sweep surfaced one **accessibility observation** (odd-one-out answer exposed via
  content-desc) which is an intentional non-visual play accommodation, not a
  defect.

## Product changes

None to game source. New reusable QA artifacts: `scripts/qa/native-game-sweep.mjs`
(native driver), `scripts/qa/merge-coverage.mjs` (coverage consolidation). These
are host-side, offline, and honor the runtime-QA contract.

## Performance changes

No application optimization was applied; see `performance.md` for the controlled
measurements and the precise reason (emulator software-rendering overhead
dominates; no safe app-controlled bottleneck confirmed). This is a deliberate,
evidence-backed non-change rather than an unmeasured claim.

## Major decisions

1. Drove the **installed production build** (QA force-hooks correctly disabled),
   completing sessions via real play/timeout rather than fabricating wins —
   preserving owner data and honoring the "dangerous QA controls off in
   production" rule.
2. Used the deep-link + semantic-id + out-of-band-screenshot harness to beat the
   slow-dump-vs-timer bottleneck without slowing production timers.
3. Did **not** flip branch protection to strict non-bypass (would break the
   mandated autonomous direct-push model); documented the tradeoff and a
   recommended successor governance change for owner authorization.

## Remaining blockers / gaps

- ARM64 runtime, physical Android, iOS simulator runtime, iOS physical runtime —
  external (no device / lane not established).
- TalkBack runtime acceptance, large-font/compact/dark/reduced-motion/landscape
  fresh re-run — tooling/budget gaps.
- Workout V3 full native lifecycle, backup/restore round-trip, upgrade/migration,
  duplicate-reward re-verification — source-covered, not re-driven live.
- 4 games remain at Level 1 (timed/keypad input shapes); L3 session-completion
  automation is limited.

## Final recommendation

**CONDITIONAL GO** — engineering scope is materially advanced with the whole
catalog now natively exercised and core critical journeys verified; release
remains conditional on the external platform tiers and owner subjective
acceptance (see `handoff.md`). This is an engineering-completion verdict, **not**
a public-release authorization and **not** owner approval.
