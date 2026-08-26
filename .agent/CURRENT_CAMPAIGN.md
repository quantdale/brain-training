# Campaign 014 — Experience Depth & Replayability (owner-authorized)

**Status:** ACTIVE — waves W1–W9 landed and pushed (head f4aa44c);
remaining: Android device journeys + docs-final reconciliation before the
terminal checkpoint. NOT COMPLETED yet.
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

See owner directive §21 (completion checklist). Progress against §21 at
f4aa44c:

- [x] Durable audit covering all 42 games + shared surfaces with evidence-
      based prioritization (`.agent/CAMPAIGN014_AUDIT.md`).
- [x] Weakest/highest-leverage games received meaningful depth improvements
      (13 games mechanically deepened; word-scramble skill-invalidating
      shortcut eliminated).
- [x] Replayability materially stronger: mastery ladder, Daily Spotlight,
      richer procedural spaces (route-path memory, Go/No-Go, proximity
      spread, uncued inference, hidden-source transform), Workout V3 loops.
- [x] Workout V3 materially improves selection and explains truthfully
      (signal-ranked ordering over the pinned deterministic base; recorded
      per-game reasons from kernel formatters; metadata v2).
- [x] Progress V3 interpretation layer without unsupported claims (mastery
      distribution + closest milestones; measured-gameplay framing only).
- [x] Home & Games discovery better support returning users without
      cluttering the first viewport (data-gated slots; unfiltered-only rails;
      Today's Workout still primary CTA).
- [x] Generator repetition/predictability improved in highest-risk games
      (pool/state-space expansions pinned by tests; near-duplicate guards
      strengthened: Hamming≥2 route memory, anti-giveaway minimal proofs,
      overlap-ranked decoys).
- [ ] Game-feel improvements measurable/observable — targeted fixes shipped
      inside game packets (respond deadline, timed brief, hidden-source
      pacing, normalized speed bonuses) but no dedicated latency measurement
      pass was performed this session.
- [x] Runtime performance baselines: statement-count guards green throughout;
      new reads are bounded pushdowns (documented in VALIDATION). Opt-in
      timing probes not re-run (recorded honestly).
- [x] Repeated-use / simulated multi-day journeys PASS through progression,
      workouts, mastery, rewards economics, persistence, app restarts, and
      rollover boundaries (`repeated-use-simulation.test.ts`).
- [x] No new unresolved Critical/High defects (two Medium-class integration
      defects found by app-shell tests were fixed same-session).
- [x] Repo validators, typecheck, lint, full Jest suite, offline boundary,
      registry/provenance checks green at head f4aa44c.
- [x] Changed persistent formats/calculation semantics properly versioned
      (workout metadata v2; generator/scoring version bumps on all changed
      games; mastery is a derived view with MASTERY_VERSION=1).
- [x] Deferred product decisions untouched.
- [ ] **Required Android journeys (Workout V3 E2E + canaries): NOT VALIDATED
      this session** — dedicated AVD went offline mid-run; foreign AVD must
      not be adopted per policy. Exact commands recorded in VALIDATION.md.
- [ ] Docs-final reconciliation sweep (README/PARITY/BACKLOG refresh beyond
      STATE/CAMPAIGN/VALIDATION/KNOWN_ISSUES) + terminal checkpoint.

