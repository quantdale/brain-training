# 013 — Full-Catalog Convergence and Campaign 006R Exit Gate

**Priority:** final blocking gate  
**Depends on:** 002–012 complete  
**Primary owner:** orchestrator  
**Runtime:** one dedicated Android AVD; no host mouse/keyboard automation

## Purpose

This is the evidence gate that prevents the project from declaring success merely because isolated unit tests are green. It validates the repaired contracts across the actual 20-game catalog and shared platform.

Do not begin this spec while any prior P1 acceptance criterion is unresolved.

## Gate philosophy

Use three layers:

1. **Static/contract validation** — registry, provenance, ownership, type system, DB constraints.
2. **Production-shaped integration** — real repositories/services/providers, not mocks where the behavior under test crosses subsystems.
3. **One-AVD runtime journeys** — prove player-visible navigation, persistence, pause/tutorial/result/workout behavior without host input.

A layer cannot substitute for another.

## A. Full registered-game contract matrix

Build/execute a machine-readable matrix for every registered game. For each of 20 games verify:

- game metadata valid and provenance classification present;
- game loader resolves through generated registry;
- tutorial metadata/lifecycle present where declared;
- all named difficulties resolve;
- adaptive path exists where game declares/supports it;
- generator/content loader validates actual outputs;
- deterministic fixed seed replay where applicable;
- scoring normalization remains in `[0,1]`;
- final challenge rating is persisted;
- session completion persists through authoritative DB path;
- returned authoritative XP equals stored XP;
- rating-bearing sessions produce expected domain mapping;
- game result surface can render committed result;
- pause/background contract does not award extra active time;
- abandon path does not grant normal completion rewards;
- QA hooks are dev-only;
- no direct network dependency is required for core play.

The matrix may use representative runtime checks where executing every mechanic deeply would be excessive, but no registered game may have an unchecked core session/persistence contract.

## B. Generator/content sweep

For every procedural/hybrid game:

- run deterministic seed sweep appropriate to its complexity;
- cover every named difficulty and representative adaptive bounds;
- assert final invariant validator passes;
- record generation latency distribution or at least worst observed runtime for the sweep;
- investigate pathological/unbounded generator cases.

For every curated-content game:

- exhaustively validate every item/prompt/template under its schema;
- validate pack identity/version/item count;
- validate difficulty-tier coverage and no empty selection pools.

Word Match and Equation Builder require their spec-specific exhaustive checks, not just generic smoke.

## C. Rating/progression end-to-end journeys

Using real DB and production services:

1. Complete Easy session -> verify authoritative XP/rating result.
2. Complete Hard session -> verify distinct challenge policy.
3. Complete Adaptive session whose final challenge differs from initial -> verify final challenge persisted/used.
4. Demonstrate high-skill/easy-farming guard using deterministic fixture.
5. Verify one gameplay completion adds exactly one session, expected XP, at most one normal gameplay currency entry, and one rating-history row per mapped domain.
6. Verify result UI shows those committed values.
7. Reopen Progress/Results and confirm same values from DB.

## D. Economy failure journeys

Programmatic integration tests must prove atomic rollback for:

- streak purchase failure;
- quest claim failure;
- achievement claim failure;
- paid reroll failure.

Then perform one normal successful AVD interaction for at least one purchase/claim and one reroll if enough test currency can be seeded through QA fixture.

No manual DB editing during the journey unless done through documented QA fixture/reset command.

## E. Tutorial restart journey

On AVD:

- clear/reset fixture;
- open representative game, complete tutorial;
- force-stop app;
- relaunch and reopen -> no automatic tutorial;
- request replay -> tutorial appears;
- verify QA skip control absent in production-shaped build mode or guarded as designed.

## F. Daily Workout end-to-end journey

Execute a complete deterministic four-game workout:

- Home shows selected 4 with inspectable personalization reasons in QA diagnostics if implemented;
- start slot 1;
- compact committed result -> Next Game;
- complete slots 2–4;
- force-stop/relaunch after at least one intermediate completed slot and verify resume;
- finish workout;
- Home/Progress reflects sessions/rewards once;
- restart after completion does not grant another free reroll or duplicate workout completion.

Run a separate reroll fixture demonstrating:

- first free reroll;
- persisted attempt after restart;
- paid next reroll debits exactly once;
- deterministic alternative selection;
- failed/duplicate request is idempotent.

## G. Streak/high-density history journey

Seed at least 60 consecutive activity dates with multiple sessions/day through test fixture/repository setup, then verify:

- Home current/longest streak;
- Profile current/longest streak;
- values match;
- recent-session limits do not truncate the streak;
- Progress still loads within reasonable time.

## H. Error/startup recovery journeys

- inject a hard DB initialization failure -> app shows explicit recoverable storage state;
- inject optional progression initialization failure -> app can still start core shell with diagnostic/degraded optional subsystem;
- inject game render error -> route-level boundary catches it and Retry/Back works;
- unsupported future schema fixture -> initialization refuses normal operation.

## I. Performance/timing sanity

This is not a full optimization campaign, but obvious regressions are blockers.

Check:

- game route/lazy-load does not repeatedly remount on ordinary rerender;
- representative timing-sensitive games remain monotonic and frame-rate independent;
- generator seed sweeps finish within reasonable bounded time;
- Home/Progress queries with synthetic long history do not visibly hang;
- no repeated DB query loop or render loop appears in logs.

Record measured timings rather than subjective “fast” where practical.

## J. Catalog redundancy review

Review all 20 mechanics against `docs/PARITY_MATRIX.md`.

For near-duplicates, especially Memory sequence variants, decide one of:

- **KEEP** — mechanic is meaningfully distinct; document distinction;
- **REDESIGN LATER** — not integrity-blocking but meaningful differentiation work recorded as Medium debt;
- **BLOCK** — duplicate/misdescribed mechanic materially undermines current catalog and must be corrected before exit.

Pattern Tap Back documentation/implementation mismatch must be resolved or explicitly classified; the product should not claim a random-walk/path mechanic that is not implemented.

## K. Required local commands

At final HEAD run and record exact outputs:

- repository-state validator;
- task ownership validator;
- registry generator `--check`;
- provenance/version validator;
- offline-boundary validator;
- contract suite;
- `npm run typecheck`;
- full Jest CI suite;
- lint gate according to Spec 012 decision;
- `npx expo export --platform web`;
- `npx expo-doctor`;
- Android smoke/journey commands used by the repo.

Then push the coherent commit and verify GitHub Actions green. If GitHub Actions cannot be read because of external permission/outage, record `NOT VALIDATED`, not PASS; campaign closure waits unless owner explicitly waives that external gate.

## L. Documentation closure

Update:

- `.agent/VALIDATION.md` — evidence with commands, test counts, AVD artifact paths, timing notes;
- `.agent/KNOWN_ISSUES.md` — only remaining Medium/Low debt with severity/rationale;
- `.agent/STATE.md` — 006R complete + next campaign;
- `docs/PARITY_MATRIX.md` if game eligibility/mechanics changed;
- relevant ADRs/spec completion statuses;
- checkpoint `.agent/checkpoints/006r-core-integrity-correction-complete.md`.

Rescope/re-stage Campaign 006 rather than blindly restoring its old content-expansion packets.

## Final MUST gate

Campaign 006R is `PASS` only if:

- no unresolved Critical/High defect;
- all 20 registered games satisfy the core contract matrix;
- Word Match semantic uniqueness passes;
- Equation Builder all-difficulty solvability passes;
- rating difficulty/adaptive/authoritative outcome journeys pass;
- tutorial restart persistence passes;
- four-game durable workout + resume + reroll journey passes;
- economy failure-injection/idempotency tests pass;
- DB future-version/integrity tests pass;
- Home/Profile streak equivalence passes under high-density history;
- semantic CI gates all pass locally;
- App CI and Repository Integrity are green on final pushed SHA;
- no host mouse/keyboard automation was used;
- main is clean and pushed;
- docs/state match actual code.

Anything less is not a completed corrective campaign.