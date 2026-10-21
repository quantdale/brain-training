# Campaign080 — native product-quality, gameplay acceptance, performance & release convergence

**Campaign id:** `080-native-product-quality`
**Status:** ACTIVE
**Mode:** day
**Starting SHA:** `f8ae95dd`
**Ending SHA:** _(pending final integration)_
**Change:** `openspec/changes/080-native-product-quality`

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
