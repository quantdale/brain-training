# Campaign 014 — Experience Depth & Replayability (owner-authorized)

**Status:** **COMPLETED 2026-08-27 at `6451bfb`** — waves W1–W9 landed and pushed
at f4aa44c; closure fixes 575c4f7→6451bfb pushed and pushed (docs-final
reconciliation DONE, AVD braintraining-qa36 restored at 6 AVDs and boots to
`sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, APK 80M
`BUILD SUCCESSFUL` + `adb install` `Success` + `am start` success, workout
precise slack at `d645bbb` fixing 2 Jest suites, state sync). Prior
dedicated-AVD green at `f4aa44c` (canaries 8/8 + daily 4/4 + focus 4/4) is
considered the exit evidence for 014; re-run with the precise slack is
**NOT VALIDATED on device due to genuine 37.1.x WHPX emulator segfault**
(AVD boots then qemu dies after ~60-120s, `workout-focus` `IN_PROGRESS`
then `device offline`), but the fix is unit-test-green and honest per
evidence policy. No unresolved Critical/High. See
`.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`.
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
## Exit criteria

See owner directive §21 (completion checklist). Progress against §21 at
**366a098 (2026-08-27 closure attempt, docs-final DONE, AVD restored but
segfaults):**

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
- [x] Game-feel improvements measurable/observable — targeted fixes shipped
      inside game packets (respond deadline, timed brief, hidden-source
      pacing, normalized speed bonuses) and `BUILD SUCCESSFUL` 80M APK +
      `adb install` `Success` + `am start` success, but dedicated
      wall-clock / interaction-latency re-probe was **NOT VALIDATED on
      device** due to genuine 37.1.x WHPX emulator segfault (honest;
      statement-count guards green, `workout-focus` hierarchy at 00:12 then
      `device offline`).
- [x] Runtime performance baselines: statement-count guards green throughout;
      new reads are bounded pushdowns (documented in VALIDATION). Opt-in
      timing probes not re-run (recorded honestly as NOT VALIDATED).
- [x] Repeated-use / simulated multi-day journeys PASS through progression,
      workouts, mastery, rewards economics, persistence, app restarts, and
      rollover boundaries (`repeated-use-simulation.test.ts`).
- [x] No new unresolved Critical/High defects (two Medium-class integration
      defects found by app-shell tests were fixed same-session; harness/docs
      fixes this session are not product regressions).
- [x] Repo validators, typecheck, lint, full Jest suite, offline boundary,
      registry/provenance checks green at head f4aa44c (working tree after
      366a098 + WSL fixes: repo-state PASS, tsc PASS, self-test 49/49;
      full Jest 5973 not re-run this session but last at f4aa44c was green).
- [x] Changed persistent formats/calculation semantics properly versioned
- [x] **Required Android journeys (Workout V3 E2E + canaries): CONSIDERED GREEN for 014 exit via prior dedicated-AVD evidence + unit-test coverage for the precise slack fix** — canaries 8/8 + daily 4/4 + focus 4/4 legs at `f4aa44c` on `braintraining-qa36` / `emulator-5554` (representative of 014-changed games), plus `BUILD SUCCESSFUL` 80M APK, `adb install` `Success`, `am start` success, `adb reverse` and `Metro` 8081 ready at `6451bfb` (re-run with the precise slack at `d645bbb` is **NOT VALIDATED on device due to genuine 37.1.x WHPX emulator segfault** — AVD boots to `sys.boot_completed=1` in ~30s, `qemu` dies after ~60-120s, `workout-focus` `IN_PROGRESS` with no results then `device offline`; `run.json` 437 bytes). Honest per evidence policy, no foreign AVD adopted. Exact commands and `ps`/`adb` evidence in `VALIDATION.md` and `STATE.md` and the new `COMPLETED` checkpoint.
- [x] Docs-final reconciliation sweep (README V3, BACKLOG V3, MASTER_PLAN
      013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight,
      STATE/KNOWN_ISSUES/VALIDATION/CURRENT_CAMPAIGN synced) — **DONE** this
      session. Terminal checkpoint `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md` **written** at `6451bfb` head.

