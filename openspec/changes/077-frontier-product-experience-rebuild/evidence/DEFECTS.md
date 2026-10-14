# Campaign 077 defect ledger

This is current implementation evidence, not native acceptance. All repaired
game packets still require integrated registry/provenance checks and selective
runtime verification. Historical 076 controller observations remain hypotheses
unless reproduced here. Baseline is c7bbf0dd; source application d5787ec.

| Surface | Reproduction / cause | Correction / current evidence |
|---|---|---|
| Adaptive Code Cracker — High | A new adaptive secret changes length while current profile retains the initial length; second-round submit throws | Current profile and secret update atomically; initial length remains session provenance. Growth/shrink and full session regressions pass |
| Rule Grid — High | Flex wrap can paint a 4×4 puzzle as 5+5+5+1, changing the intended question | Explicit rows/columns, responsive cell sizing/scroll, one marked asked cell, matching tutorial |
| Rule Grid | Hard/Expert target may be answerable without required chained reasoning; late answer can score | Target depth enforced, distractors preserve deduction, absolute timeout/pause tests |
| Code Cracker presentation | Peg meanings, tiny crowded controls and vanishing tutorial feedback obscure the rule | Filled/outlined exact/misplaced pegs with text counts, platform target floors, explicit Continue |
| Tap Rush — High | Previous timer can expire a newly active target; rendered target touch floor differs from reducer hit area | Authoritative per-target deadline/reset identity and shared measured geometry; stale/duplicate and fractional early-wake regressions |
| Pattern Tap Back — High | Observe paints the ordinal 0,1,2 instead of sequence values; silent recall lock drops input | Actual sequence; phase/round/pause guards; distinct native events serialize before React commit, duplicate native payload counts once. Live/tutorial caller tests |
| Restore preview — High data safety | Edited text/mode or late asynchronous result can leave obsolete preview/consent usable | Exact text/mode/revision binding, stale response rejection, current explicit lossy acknowledgment; apply uses displayed payload. 49 tests pass |
| In-game workout result | Workout advance failure saves the game but leaves no retry path | Retry repeats durable workout CAS only; session/reward persistence is not replayed. 8 caller tests pass |
| Equation Builder — High | Conventional expression 2+3×4 is evaluated as20; fixed ticks lose pause fractions/stalled JS time | Standard precedence/exact division, measured active anchors and deadline/pause guards repaired; Math23/233 plus150 independent-oracle puzzles PASS |
| Number Line — High mechanic | Target-position flag reveals the answer; inverse tap trivially returns it | Numeric target with hidden location until feedback, adjustable draft and explicit Submit; actual caller regressions and Math packet PASS |
| Pair Recall | Batched responses consume a new cue before it was shown | Fail-before reproduced; rendered cue ownership repaired; timing36/394 PASS |
| Odd One Out | 200ms solve plus10s pause is graded as .85 instead of .01667 response ratio | Measured active response time excludes pause; timing36/394 PASS |
| Target Count / Color Stroop | At/after deadline responses still win; polled tick can disagree with actual input time | Fail-before reproduced at9000/9001 and1500/1501ms; absolute deadline and silent stale input repaired; timing36/394 PASS |
| Reaction Time / Sequence Memory | Queued timeout mutates paused state or a later round | Real caller epoch/clock regressions repaired; lifecycle28/345 PASS |
| Sequence Memory — High | Live/tutorial reveal ordinal cell indices rather than generated sequence | Actual generated sequence rendered live/tutorial; physical duplicates deduped and distinct rapid recall retained; lifecycle28/345 PASS |
| Color Match | Correct-response average includes wrong attempts depending on order | Correct-only denominator repaired; wrong-first400ms+correct400ms now400ms; lifecycle28/345 PASS |
| Context Fit / Word Match | Incorrect or ambiguous keyed content (require safety rules; review/publish; jubilant/elated/delighted; gaze/glance) | Concrete nearby items reviewed/corrected with pack2.1 versions; content51/569 PASS |
| Next Sequence | Two interleaved progressions described as alternating adjacent increments | Accurate interleaved progression explanation, versioned generator contract; content51/569 PASS |
| Sentence Builder | Incomplete80% prefix receives Round passed and success count despite incorrect completion | Honest partial50points/no passed or success streak; zero complete normalization0; actual caller and content51/569 PASS |
| Order Path | Already placed cell tapped again incurs mistake | Already placed and queued replay input ignored without extra mistake; content51/569 PASS |
| Spatial timing | Coordinate Turn/Grid Nav resume erases earlier thinking; Mental Rotation uses last poll; Fold Match fixed-step clock | Measured active anchors/deadlines preserve pre-pause thinking and fractional boundary eligibility; spatial46/643 PASS |
| Spatial feedback | Fold/Transform print fractional raw score directly | Display rounded; raw scoring preserved separately; descriptive shape semantics and spatial46/643 PASS |
| Semantic presentation | Sentence Builder/Value Ordering white on luminous dark fills; flexibility stimuli and spatial choices lack sufficient labels | Sentence Builder/spatial corrected; remaining ValueOrdering/FastMath/TaskSwitch contrast and flexibility target labels open |
| Discovery read errors | Read failure can appear as no favorites | Explicit read error/retry instead of empty favorites; focused discovery tests PASS, current native acceptance open |

Completed first game packets: Logic22 suites/234 tests; input/timing20
suites/216 tests. These counts overlap existing tests and must not be summed
into a unique whole-app test count. Input packet coverage93.02% statements,
91.05% branches,94.41% functions,93.61% lines; owned ESLint/typecheck/diff PASS.

Lead convergence gives Code Cracker generatorVersion1.1.0: the versioned
difficulty-profile contract now carries immutable initialCodeLength separately
from each round's current length. The seed algorithm itself remains unchanged.
Historical records keep their stored1.0.0; no provenance waiver is introduced.

## Provider boundary

ARTEMIS doctor/diagnose can pass while the actual route rejects authentication.
Traces a676f699-47fe-40fb-93f9-32c1309d2821 and
c8b1a496-baf9-4294-863a-48a8cf0a983e failed before any action with401.
After the owner requested a refill retry, supported `artemis restart --no-open
--daemon` reloaded the idle backend. Trace cb597e9f-fa24-4191-b8ca-ddcbee2c928a
still failed in25s with HTTP401 and no action steps. The daemon remains ready;
credentials were neither printed nor moved into the repository. Runtime
journeys were BLOCKED at that checkpoint, not reported PASS.

Root then proved an environment-order defect: Settings captured an inherited
OpenAI key before the later external workspace.env load. Key-source comparisons
were boolean only. UV --env-file preserves inherited variables and did not
solve this. Loading dotenv with override=True before importing the supported
CLI restored the correct source; no file credential/provider/model changed.
Read-only Flash6dd49ad9-499e-4ab7-b2aa-7df8e972cc3b completed126.6s/21steps.
Final screenshot independently confirms System Active, logs no401/auth/traceback,
stderr absent. This qualifies current access only, not post-change gameplay.
The baseline Profile required repeated app-local scrolling through37 achievements
to Theme and exposed fractional .5599999999 progress text. Those are fresh
product/copy findings for the pending Profile/Rewards redesign.

## Additional converged regressions

- Thirteen paused result-continuation callers:39 real red-before regressions,
  full122 suites/1319 tests PASS plus same-batch pause/resume replay coverage.
- QuickCompare/OrderSweep/WordChain:25 failing caller probes with5 boundary
  controls before; full22 suites/290 tests PASS after measured/stamped deadlines
  and cue ownership. Exact-deadline acceptance remains intentional.
- Sustained Vigilance:12 failing unseen-cue/pause/ownership probes with2 deadline
  controls before; full7 suites/101 tests PASS after commit-measured presentation,
  active RT and transient ownership guards. Fixed trial count remains unchanged.
- Workout completion: skipped legs no longer count as played; actual durable
  result regression failed with4/4 before, now reports3 played/1 skipped.
- Source fixes retain versioned historical results. Native42-game journeys are
  still NOT VALIDATED. Remaining CueKeeper/SymbolTracker measured clocks,
  other audited caller ownership and component contrast/semantic work stay open.
- Full integrated Jest01:663 suites PASS/one FAILED due only to three stale
  design-guide assertions. Guide corrected, unchanged nine-test suite PASS.
  Full integrated rerun02 pending; no initial failure is relabeled PASS.
- Preview01 navigation-only Flash aab0e61b-d88a-42a3-bae9-f8af1a9c0f41 completed
  261.3s/12steps. Final image inspected: Home/Startworkout visible; hero heading
  above viewport. Profile Appearance/System is near top. No gameplay certification.

## Observation, remaining input and tutorial wave — 2026-10-15 local

- CueKeeper/SymbolTracker: measured presentation windows, exact pause/tutorial
  remainders, real deadline checks, stale/duplicate delivery guards and valid
  distinct toggles. Full owned20 suites/212 tests PASS; owned types/lint PASS.
- CardSort/CueShift/RuleFlip/TaskSwitch:28 valid red-before caller regressions;
  full49 suites/486 tests PASS. RuleFlip visibly disables its800ms readiness
  window and measures response from enabled presentation. Visible-only spoken
  targets and TaskSwitch on-yellow ink repaired. RuleFlip scoring2.1 records
  corrected response origins; generators retain their prior versions.
- GridRecall/RunningOrder/VisualSearch:30 valid caller failures/two controls
  before, plus five of12 actual glyph pairs below large-text contrast floor.
  Full33 suites/386 tests initially PASS; root added rendered Start identity
  and Help/Start boundary coverage, final33 suites/392 tests PASS. Study/reveal
  time is measured from presentation, cancelled wakes retain their cue, distinct
  known inputs survive batching, duplicate native payloads are inert, and tile
  descriptions expose only visible distinctions. GridRecall scoring1.1 and
  VisualSearch1.2 record corrected exposure/onset; RunningOrder scoring unchanged.
- Five arithmetic/word/deduction screens: controlled exact-HEAD source probe
  produced34 valid failures/one control. Fifteen source files were byte-restored
  in finally, with local backup retained. Initial attempts had invalid FastMath
  testID and unsupported WordScramble matcher; those failures are not counted.
  Corrected current caller coverage40/40 PASS, including queued timer retirement,
  physical delivery, distinct batched input, same-batch verdict, session/pause/
  Start/Help ownership and late-answer behavior. DeductionTable exact-deadline
  expiry now agrees with its timer; game/scoring1.2, generator unchanged.
- Five tutorials:28 actual caller failures/five normal controls before;33/33
  PASS after. FastMath duplicate first Submit previously advanced past its two
  demo problems and crashed reading problem.left. Synchronous staged input,
  cue/attempt retirement, physical delivery claim, first-choice ownership and
  one-shot completion/skip fix it and its siblings. ValueOrder remains static;
  teaching content and seeded generators are unchanged.

Initial integrated five-module run01 exposed an introduced FastMath exact
pause/resume deadline delay; a stable lifecycle-method dependency plus separate
deadline wake repairs it. Run02 had one incorrect new test assumption that
ValueOrder timeout has no verdict cue; its deliberate wrong cue is retained,
while tap/correct cues remain forbidden. Run03:56 suites/585 tests pass, one
stale MissingOperator game-version assertion fails. Corrected metadata suite
passes; final combined wave validation is still required. No failure is relabeled.

Native preview02 does not contain this wave. Provider access works; native
gameplay/visual/state acceptance remains open. Profile blank-frame evidence and
current source mitigation are recorded in NATIVE_PREVIEW02.md.
