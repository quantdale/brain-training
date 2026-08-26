# Campaign 014 — Experience Depth & Replayability (owner-authorized)

**Status:** ACTIVE (opened 2026-08-26)
**Campaign id:** `014-experience-depth-replayability`
**Predecessor:** `013-final-product-completion` (COMPLETED 2026-08-26 —
v1 release candidate certified, 42/42 Android certify green)
**Mode:** day
**Authorization:** explicit owner directive — brand-new product-expansion
campaign. Not a hardening campaign; Campaign 013 guarantees are not reopened
unless changed code materially affects them.

## Mission

AUDIT → MEASURE → PRIORITIZE → DEEPEN → POLISH → INTEGRATE → VALIDATE → PROVE.

Central question: *after the novelty of the first few sessions wears off, is
this still an app someone would genuinely want to use repeatedly for weeks or
months?* Make the answer materially closer to **yes**. Depth over feature
count. Do not add games beyond 42; do not preserve weak mechanics merely
because they pass tests.

## Workstreams

1. **W1 — Product-depth audit**: evidence-driven rubric over all 42 games +
   major shared surfaces (mechanical depth, novelty, difficulty scaling,
   Expert quality, generator entropy, near-duplicates, degenerate strategies,
   timing fairness, feedback quality, mastery potential). Produces
   `.agent/CAMPAIGN014_AUDIT.md` with ranked priorities.
2. **W2 — Per-game mastery system**: understandable capability/completion
   depth per game (not a second XP). Persisted deterministically, versioned;
   exposed in Games/Game Detail/Progress/Home/workout inputs without
   cluttering the first viewport.
3. **W3 — Replay hooks/challenges**: daily deterministic challenge seam +
   per-game-appropriate constraints; personal-best attack loops. No
   leaderboards/social/server. Shared infrastructure only where semantics are
   truly shared.
4. **W4 — Workout V3**: wire the Advanced Personalization V2 kernel signals
   (undertrained/novelty/trend/PB-proximity/difficulty-fit/overexposure) plus
   mastery into selection with truthful per-game explanations; keep
   determinism, reroll economics, and progression integrity.
5. **W5 — Progress V3**: interpretation layer over stored data (strongest/
   weakest, neglected categories, consistency, mastery distribution, recent-
   vs-lifetime), summary-first, no unsupported cognitive claims; bounded
   queries on long histories.
6. **W6 — Home & discovery for returning users**: nearby milestones,
   PB opportunities, neglected games, "what changed", richer Games-library
   shelves; first viewport stays clean; Today's Workout remains primary CTA.
7. **W7 — Generator-quality measurement & fixes**: measure near-duplicate
   rates/effective spaces across procedural generators; improve the highest-
   risk ones; version any semantic change.
8. **W8 — Repeated-use simulation**: deterministic multi-day journeys over
   progression/workouts/mastery/rewards/persistence/rollover boundaries using
   fake clocks; not production-visible.
9. **W9 — Game feel/performance/a11y/storage passes**: measured where
   practical; targeted fixes only on evidence; runtime baselines recorded.
10. **W10 — Validation & closure**: impact-based validation during waves;
    device validation at convergence points on `braintraining-qa36` ONLY
    (foreground preflight); full catalog certification if shared lifecycle
    changes warrant it; docs reconciliation; terminal checkpoint.

## Exit criteria

See owner directive §21 (completion checklist). The campaign is COMPLETED
only when every item is satisfied with concrete before/after evidence, all
required gates are green, durable state reflects reality, and `main` is
pushed. No new unresolved Critical/High defects.
