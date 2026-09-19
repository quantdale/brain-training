## 1. Research, baseline and refinement lock

- [ ] 1.1 Read the Campaign 052 acceptance evidence (prose and committed pixels) and Campaign 054 terminal matrices; record the evidence conflict about active gameplay and resolve it in the lock.
- [ ] 1.2 Capture fresh baseline native pixels from `f59c066` for Home, Games, Game Detail, tutorial, gameplay, Result, Progress, Profile, Rewards, dark Games/Result and completed workout.
- [ ] 1.3 Run targeted Refero research for storefront, detail, results, identity, collectibles, progress and HUD; write `TARGETED_REFERO_RESEARCH.md` with exact references and borrowed/rejected items.
- [ ] 1.4 Write `CURRENT_BASELINE.md` and `REFINEMENT_LOCK.md` and lock them before broad implementation.

## 2. Shared visual system

- [ ] 2.1 Add the typography voices and shape-role documentation; keep the contrast suite green.
- [ ] 2.2 Re-point colour slots only per the semantic table and verify contrast/a11y tests.
- [ ] 2.3 Implement `ArcadePanel`, `Report`/`ReportRow`, `GameStage`, `CollectibleTile` and the `flush` Card variant with focused tests.
- [ ] 2.4 Implement shared result primitives (band model, artifact, reward chip row) with focused tests.
- [ ] 2.5 Verify affected shared-layer tests, typecheck and one representative screenshot before surface work.

## 3. Games storefront (RETHINK)

- [ ] 3.1 Recompose the catalog as featured stage + poster grid; remove repeated banner→badge→title→paragraph grammar.
- [ ] 3.2 Keep search/filter powerful with quieter chrome and correct count behaviour during search.
- [ ] 3.3 Make identity visible before metadata for every tile; verify 42-game coverage and scrolling performance.
- [ ] 3.4 Update Games focused tests and snapshot intentionally; capture before/after pixels.

## 4. Results (RETHINK)

- [ ] 4.1 Recompose in-session and route results around one artifact with a single band headline.
- [ ] 4.2 Remove duplicate score statements and raw debug-like timing; make metrics a supporting strip.
- [ ] 4.3 Separate performance, completion and reward honestly; no success colour/celebration on weak performance.
- [ ] 4.4 Enforce the action hierarchy for standalone and workout contexts; keep reduced-motion excellent.
- [ ] 4.5 Update Results/GameResults tests; capture 0-score, mid-score and personal-best evidence.

## 5. Profile (RETHINK) and Rewards (REFINE)

- [ ] 5.1 Recompose Profile's first viewport as player identity with owned progression, streak rail and equipped cosmetics.
- [ ] 5.2 Remove placeholder/internal identity language and demote settings/data to quiet entries.
- [ ] 5.3 Recompose Rewards collection as a collectible grid with clear owned/equipped/locked states and quiet progress.
- [ ] 5.4 Update Profile/Rewards focused tests; capture before/after pixels.

## 6. Home (REFINE) and Game Detail (REFINE)

- [ ] 6.1 Give Home one dominant daily object and a subordinate context area; keep ready/active/completed states honest.
- [ ] 6.2 Increase Game Detail game-world pull with a dominant Play action and clearly secondary records.
- [ ] 6.3 Update Home/Detail focused tests; capture states.

## 7. Tutorial, gameplay and Progress

- [ ] 7.1 Refine tutorial chrome to one concept at a time with anticipation, preserving every rule and accessibility.
- [ ] 7.2 Improve gameplay stage/header/feedback identity without changing mechanics; validate representative games across all eight domains.
- [ ] 7.3 Reduce Progress analytics-software feel while keeping every number and window truthful.
- [ ] 7.4 Update focused tests for tutorial/gameplay/Progress; capture evidence.

## 8. Copy and labels

- [ ] 8.1 Audit visible product-facing copy touched by these surfaces and write `COPY_AND_LABEL_AUDIT.md`.
- [ ] 8.2 Implement the copy repairs; verify no unsupported cognitive/medical claims and no changed numbers.

## 9. Mandatory critiques

- [ ] 9.1 Pass A "Would I browse this?" across Home/Games/Detail/Profile/Rewards; repair the strongest issues.
- [ ] 9.2 Pass B "Does play feel better than admin?" across tutorial/gameplay/Results/Progress; repair the strongest issues.
- [ ] 9.3 Pass C "Did we over-style it?" across saturation/clutter/animation/readability/a11y/performance/density/dark contrast/adult credibility; repair the strongest issues.
- [ ] 9.4 Record all three passes in `VISUAL_CRITIQUE.md` with evidence.

## 10. Validation, evidence and closure

- [ ] 10.1 Run focused validation continuously during implementation; never defer to the end.
- [ ] 10.2 Capture final-release native matrix: Home ready/active/completed, Games, search, distinct games, Detail, tutorial, gameplay, Result, 4-game workout, Progress, Profile, Rewards, dark, compact, font scale 2, force-stop/relaunch, offline, invalid route, SQLite integrity, duplicate-effect audit, fatal/ANR/SQLite log review.
- [ ] 10.3 Produce the Campaign 055 evidence packet (closure, baseline, research, lock, change matrix, copy audit, critique, before/after, a11y/responsive QA, performance sanity, final repository/native validation).
- [ ] 10.4 Run the authoritative current repository matrix (full Jest, console gate, opt-in probes, typecheck, lint, Expo Doctor, OpenSpec strict, repo-state, task ownership, affected map, registry, offline, secrets, provenance, workflow hygiene, dependency audit, runtime QA contract, web export, Android debug and release builds).
- [ ] 10.5 Update durable state (STATE, VALIDATION, CURRENT_CAMPAIGN, KNOWN_ISSUES/BACKLOG as needed), commit/push coherent slices, verify `HEAD == origin/main` and a clean tracked worktree, and record the final verdict.
