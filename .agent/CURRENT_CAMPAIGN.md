# Campaign080 — native product-quality, gameplay acceptance, performance & release convergence

**Campaign id:** `080-native-product-quality`
**Status:** ACTIVE
**Mode:** day
**Starting SHA:** `f8ae95dd`
**Ending SHA:** _(pending final integration — latest checkpoint `77972354`)_
**Change:** `openspec/changes/080-native-product-quality`

**Progress (2026-10-21 checkpoint — SUPERSEDED, retained as history):**
MATERIALLY ADVANCED, NOT COMPLETE. The flagship workstream (fresh native runtime
coverage of all 42 games) was delivered via a new deterministic sweep harness.
NOTE: that checkpoint's coverage figures and the ledgers behind them FAIL
independent artifact verification (see the 2026-10-22 block below — the sweep's
fixed artifact root overwrote earlier evidence). They are historical observations,
not certification. Core critical journeys verified (Pause/Resume/Quit, correct/incorrect
scoring, offline airplane mode). Performance evidence gathered with emulator
overhead separated (no false optimization claimed). Governance SHA
reconciliation + administrator-bypass review + security re-check done. Full
local gates GREEN (typecheck/lint/jest 711/8018/10 repo gates/OpenSpec 207/207).
Application source unchanged. Remaining achievable work (Workout V3 native,
backup/restore round-trip, a11y profiles/TalkBack, deeper L3) is why the
campaign remains ACTIVE for continuation — see
`docs/certification/080-native-product-quality/handoff.md`.

**Progress (2026-10-22, latest checkpoint `77972354`):** BOTH newly identified
artifact-verifier defects are FIXED and tested (F-080-NEW-001 fail-open exit;
F-080-NEW-002 mixed-build single-build pass), with the verdict/exit contract
unified into one pure module and 40 real process-exit CLI tests. The
guided-tutorial solver system is delivered (12 deterministic families, 3 honest
solve tiers) and unlocked a materially larger certified footprint. A CRITICAL
evidence-integrity defect was found by the campaign's own verifier: the sweep's
fixed artifact root overwrote earlier evidence (482 of 1100 paths carried
conflicting digests), so every pre-fix ledger is retained but FAILS independent
verification and its numbers are NOT cited. Under per-run artifact isolation the
authoritative verified ledger is `native-coverage-ledger-v8.json` —
**verdict=PASS, 1119 artifacts, zero tolerance counters, single build** — giving
**7 L3 / 13 L2 / 8 L1 / 14 L0** (previous certified baseline 4/6/8/24). Residual
L0 are stimulus-observation-rate limits, recorded honestly as automation gaps,
not app defects. Remaining: Workout V3 native lifecycle, native backup/restore
round-trip, accessibility profile matrix, and the SECOND INDEPENDENT ADVERSARIAL
REVIEW — which is BLOCKED_EXTERNAL: all three reviewer routes failed for
environmental reasons (Claude OAuth expired; Codex sandbox read-only; built-in
reviewer quota exhausted until 2026-10-27). No self-review is substituted and
labelled independent.

Owner-authorized (2026-10-21) bounded successor to Campaign 079 (CONDITIONAL
GO). Objective: eliminate the achievable product-quality, native-validation,
performance, accessibility, and release-certification gaps left by Campaign
079. The mandate spans nine workstreams: (A) native gameplay coverage toward
all 42 games, (B) critical end-to-end journeys (correct/incorrect scoring,
Pause/Resume/Quit, Workout V3, results/progression, offline), (C) evidence-based
performance optimization, (D) visual/UX/gameplay corrections, (E) accessibility
and responsive convergence, (F) data integrity/persistence/offline/recovery,
(G) iOS and physical-device qualification gap reduction, (H) release governance
and certification-evidence correction (final-SHA reconciliation, administrator-
bypass review), and (I) independent regression testing and final integration.

Success is defined by real behavior, not documentation. Unqualified GO is not
claimed unless all mandatory release criteria, including external ones, are
genuinely satisfied. The campaign closes as `VALIDATED_WITH_LIMITATIONS` (or the
repository's established equivalent) only when actionable in-scope P0/P1/P2
defects are resolved or genuinely blocked, the game catalog has a fresh explicit
native coverage matrix, native testing is expanded as far as the environment
allows, reachable critical journeys are exercised or have reproduced blockers,
confirmed performance bottlenecks are corrected with comparison evidence,
visual/accessibility checks are executed, persistence/offline testing is
expanded, platform status is honest, CI is green at the final integrated SHA,
and an independent reviewer has evaluated the closing evidence.

Deliverables under `docs/certification/080-native-product-quality/`. Progress is
recorded in `.agent/STATE.md` and the 080 OpenSpec tasks as workstreams close.

## Historical note — Campaign079 (closed, status VALIDATED)

Campaign079 stabilization/acceptance/certification is terminally VALIDATED with
verdict **CAMPAIGN_079_CONDITIONAL_GO_PENDING_OWNER_ACCEPTANCE** (started
`64c1df4d`, closed `9c4dd138`; authoritative reports under
`docs/certification/079-release-certification/`). Its engineering foundation is
the stable baseline this campaign builds on. It is not reopened.

## Historical note — Campaign078 (closed, status VALIDATED)

Campaign078 game-cover visual identities remains terminally VALIDATED with
verdict CAMPAIGN_078_EMULATOR_REVIEW_READY_WITH_LIMITATIONS; its frozen
production source 359a80be and full evidence under
`openspec/changes/078-game-cover-visual-identities/evidence/` are immutable
history and were not reopened by Campaign079/080. Earlier bounded repairs
recorded in .agent/STATE.md (2026-10-19 explore-findings convergence,
ui-scaling repair, tutorial/Start repair; 2026-10-21 fresh-machine setup +
red-gate repair) are likewise historical.
