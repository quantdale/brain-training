# Campaign 077 current source disposition

Source reviewed: `afabda3a74201d3bbd7da22da9d0ecbf99bf7878` on `main`.
Historical comparison: `c7bbf0ddfa184204027d8b6df14deab5abf87a6e`.
This record reconciles the original owner brief, [GAME_AUDIT.md](GAME_AUDIT.md),
[DEFECTS.md](DEFECTS.md), [STATUS_CONVERGENCE.md](STATUS_CONVERGENCE.md), current
source/tests and recorded run results. No tests, builds or device actions were
run for this documentation packet. It does not change task checkboxes or grant
campaign, visual, runtime or owner acceptance.

## Disposition and evidence precedence

The confirmed repair families in the game ledger are **repaired in source and
covered by passing caller/regression tests** at this checkpoint. No confirmed
High/Critical source defect in those ledgers remains unfixed. Selective native
qualification, responsive visual review and final runtime gates remain separate.
This is a bounded reconciliation, not proof that the product has no undiscovered
defects.

The original GAME_AUDIT rows and intermediate DEFECTS paragraphs preserve the
state when written. Their open observation/input/contrast/tutorial followups are
superseded by the later observation/convergence tables, presentation recovery,
status convergence and current clean-checkout evidence. In particular:

- The fourteen remaining observation/input modules are repaired; combined
  169-suite validation supersedes their intermediate “integrated check pending”.
- GridNavigator and TransformMatch tutorial repairs supersede the earlier
  “sibling packet active/new native proof required” source status. Grid's normal
  default native tutorial was subsequently verified; other profiles and active
  gameplay remain separate.
- All 42 games' functional outcome renderers and the remaining shared controls use the
  selected vector family. Celebration text now uses shared typography/bounds.
- Whole Jest06 predates the last inline data-message move, but the actual
  independent **afabda3a clean checkout includes that change and passes**. Its
  result supersedes STATUS_CONVERGENCE's then-open final-source composite gate.

The directory-to-ledger reconciliation finds **42 game modules, 42 assessed IDs,
no missing ID**. This supports the assessment count, not 42 fresh native journeys.
The ledgers mix overlapping repair packets, individual findings and presentation
standardization. They do not define a deduplicated “games with confirmed defects”
metric; no unique confirmed-mechanic-defect count is invented here. The games and
repair families are enumerated below.

## Recorded validation used here

These are existing results, not newly executed checks. Packet totals overlap
and must not be added together.

| Key | Recorded evidence | Scope and limit |
|---|---|---|
| L | Logic 22 suites/234 tests PASS | Adaptive profile growth/shrink, full-session submit, RuleGrid geometry/depth/deadline and presentation |
| I | First input/timing 20/216 PASS | TapRush geometry/deadline and PatternTapBack reveal/input; coverage93.02/91.05/94.41/93.61% statements/branches/functions/lines |
| T | Remaining timing 36/394 PASS | PairRecall, OddOneOut, TargetCount and ColorStroop actual caller timing |
| Y | Lifecycle 28/345 PASS | ReactionTime/SequenceMemory queued timeout/reveal and ColorMatch correct-only response average |
| M | Math 23/233 plus150 independent-oracle puzzles PASS | EquationBuilder precedence/exact division/active clock and NumberLine hidden-answer input |
| C | Content 51/569 PASS | WordMatch/ContextFit pack2.1, NextSequence explanation, SentenceBuilder honest partial and OrderPath replay |
| S | Spatial 46/643 PASS | Active thinking/deadlines/pause, rounded display and descriptive choices |
| B | Base Memory 12/101 PASS;9 valid fail-before probes | Actual sequence, observed exposure, paused/stale wakes, native delivery dedup and distinct rapid recall |
| P | Paused continuation122/1319 PASS;39 valid fail-before probes | Thirteen sibling result-Next callers; same-batch pause/resume replay |
| Q | Remaining cue22/290 PASS;25 valid fail-before probes plus5 controls | QuickCompare, OrderSweep, WordChain rendered input and timer ownership |
| V | Vigilance 7/101 PASS;12 valid fail-before probes plus2 controls | Commit-measured trial onset, active RT and stale/pause ownership; fixed trial count retained |
| O | Observation 20/212 PASS | ProspectiveCue/SymbolTracker measured windows, pause remainders and input ownership |
| F | Flexibility 49/486 PASS;28 valid fail-before probes | CardSort/CueShift/RuleFlip/TaskSwitch input/tutorial ownership, readiness, semantics and contrast |
| R | Memory/search 33/392 PASS;30 valid fail-before probes plus2 controls | GridRecall/RunningOrder/VisualSearch observed exposure/input/contrast; final6 Start/Help checks included |
| A | Five screen callers40/40 and tutorials33/33 PASS | FastMath/MissingOperator/ValueOrdering/WordScramble/DeductionTable;34 valid screen failures/1 control and28 tutorial failures/5 controls before |
| W | Combined 169 suites/1735 tests/5 snapshots PASS | Current observation/input/Progress/shared-caller convergence; global types and zero-warning full-source lint PASS |
| U | Tutorial/presentation integration45/576 PASS | Grid tutorial3/3 after2 valid failures+1 control; Transform5/5 after4 valid failures+1 control, its full11/143 PASS |
| X | Vector A17/78, B149/1680, C19/88 PASS | All 42 games; actual rendered SVG, semantics and retained stimuli. C's first13-suite/26-assertion fixture failure is retained, corrected to supported queries |
| D | Data 49/49 PASS | Exact preview/consent binding and operation feedback. Two feedback-location assertions fail before the final move; all49 pass after |
| Z | Actual independent afabda3a clean checkout PASS | Fresh dependencies, full unflagged composite,702 suites/7903 tests/5 snapshots,382.226s;4 skipped suites/5 reviewed opt-in tests, zero failures; includes final data change |

L–U and their real before/after boundaries are recorded in the linked game/defect
ledgers and [PRESENTATION_RECOVERY.md](PRESENTATION_RECOVERY.md); X/D in
STATUS_CONVERGENCE. Z is recorded in [NATIVE_PREVIEW06.md](NATIVE_PREVIEW06.md),
with local `qa-artifacts/campaign077/clean-checkout-afabda3a.log` and
`clean-checkout-afabda3a-jest-summary.json`. The latter JSON was inspected for
this reconciliation. All listed passing packet suites are also covered by the
current full run. Earlier failed runs are not relabeled.

## All 42 game source dispositions

Every ID below resolves to `apps/mobile/src/games/<id>/`; its production code,
`game.json` and `__tests__/` form the ownership boundary. Each row is **source
repaired/assessed, native qualification bounded**. X/Z apply to every row. A
sample regression file is named where useful; the keys identify the wider
recorded caller evidence. Rows do not assert exhaustive puzzle or native-state
coverage.

| Game ID | Current source disposition and concrete regression evidence |
|---|---|
| memory | Actual generated sequence live/tutorial, observed exposure, stale/pause guard, duplicate delivery versus valid rapid recall; B, `observed-input.test.tsx` |
| memory-grid-recall | Measured study exposure, rendered/session/pause and physical-event ownership; visible-only target labels; P/R, `input-ownership.test.tsx` |
| memory-pair-recall | A batch cannot consume an unseen next cue; measured timing and paused/stale guards; T, `input-timing.test.tsx` |
| memory-pattern-tap-back | Ordinal reveal and silent input lock repaired; actual sequence, physical dedup and distinct known recall; I, `observed-input.test.tsx` |
| memory-prospective-cue | Callback-count clock replaced by commit-measured exposure/deadline; exact pause remainder and cue ownership; P/O, `observed-clock.test.tsx` |
| memory-running-order | Measured symbol exposure, cancelled wake, staged suffix/tutorial input and glyph contrast repaired; P/R, `input-ownership.test.tsx` |
| memory-sequence-memory | Actual live/tutorial reveal and queued timeout ownership; valid batched recall retained; Y, `lifecycle-regressions.test.tsx` |
| attention-odd-one-out | Response interval excludes pause; rendered cue/input ownership; T, `input-timing.test.ts` |
| attention-target-count | Actual deadline and poll agree; late/stale inputs cannot announce a win; T, `input-timing.test.tsx` |
| attention-visual-search | Commit-measured onset/response, original session budget, duplicate/stale cue and visible-feature semantics; P/R, `input-ownership.test.tsx`; denominator hypothesis not reproduced |
| attention-symbol-tracker | Commit-measured observation/response, actual submit deadline, pause remainder, labels and duplicate toggles; P/O, `observed-clock.test.tsx` |
| attention-sustained-vigilance | Unseen trial cannot expire before presentation; active RT, pause bank and one sensory claim; V, `clock-fairness.test.tsx` |
| speed-tap-rush | Rendered/logical hit geometry unified; old/early target timer cannot expire new cue; I, `input-timing.test.tsx` |
| speed-reaction-time | Active onset/deadline and queued timeout/session/pause ownership; Y, `lifecycle-regressions.test.tsx`; NO-GO stimulus retained |
| speed-color-match | Correct-only response denominator plus measured onset/duplicate/pause guards; Y, `average-regressions.test.tsx` |
| speed-quick-compare | Rendered cue/deadline claim and cancelled/early timer ownership; intentional exact-deadline acceptance retained; Q, `cue-input-regressions.test.tsx` |
| speed-order-sweep | Replayed cleared token inert; known distinct rapid numbers remain valid; actual/cancelled deadline guard; Q |
| math-fast-math | Staged digits/submit, cue/session/pause/physical ownership and readable key fill; duplicate tutorial submit crash repaired; P/A/W, `input-ownership.test.tsx`, `tutorial-input.test.tsx` |
| math-missing-operator | Answer claimed before sensory feedback; overdue input silent, queued timeout retired, tutorial ownership; P/A/W, same two named files |
| math-value-ordering | Cue/physical ownership, valid staged known picks, deadline and on-fill ranks; deliberate timeout verdict retained; P/A/W, same two named files |
| math-equation-builder | Standard precedence/exact division and active anchors/deadline preserve conventional answers and paused fractions; M, `precedence-regressions.test.tsx`, `active-clock-regressions.test.tsx` |
| math-number-line-estimation | Numeric target without revealed location, adjustable draft and explicit Submit; M, `estimation-regressions.test.tsx` |
| language-word-match | Concrete ambiguous keyed synonyms corrected with content pack2.1; C; untimed choice/lifecycle assessed |
| language-context-fit | Eight ambiguous keyed contexts corrected with pack2.1; C; actual rendered options reviewed |
| language-sentence-builder | Incomplete 80% prefix is honest partial 50, no passed/streak; zero complete normalizes 0; timeout counts and on-fill contrast retained; C, real persisted caller regression |
| language-word-chain | Rendered step identity, deadline/cancel ownership and active per-step RT; Q; shallow distractors remain design debt |
| language-word-scramble | Staged selection/submit and one verdict, cue/session/pause/physical ownership, first tutorial choice owns answer; P/A/W, `input-ownership.test.tsx`, `tutorial-input.test.tsx` |
| logic-code-cracker | Current adaptive profile/secret update atomically; immutable initial provenance, growth/shrink/full-session submit; peg counts/targets/tutorial Continue; L |
| logic-rule-grid | Explicit exact rows, marked asked cell, Hard/Expert chained depth and deadline/pause; L, `presentation-regressions.test.tsx` |
| logic-next-sequence | Correct interleaved-stream explanation, versioned contract; C, `explanation-regressions.test.ts` |
| logic-order-path | Already placed/queued replay does not add mistake; placed cells disabled; C |
| logic-deduction-table | Synchronous answer claim, cue/session/pause ownership, captured timer, exact-deadline input agrees with expiry; A/W, `input-ownership.test.tsx`, `tutorial-input.test.tsx` |
| flexibility-color-stroop | Actual deadline and unavailable-response flip guard prevent optimistic result; T, `input-timing.test.tsx` |
| flexibility-card-sort | Rendered/session/pause/physical ownership and one sensory claim; cancelled switch notice/tutorial ownership; P/F, `rendered-input.test.tsx`, `tutorial-input.test.tsx` |
| flexibility-cue-shift | Same ownership/claim family plus visible-only spoken target; P/F, `rendered-input.test.tsx`, `stimulus-accessibility.test.tsx` |
| flexibility-rule-flip | Visible disabled 800ms arm window; RT begins at enabled presentation; ownership and spoken target; P/F, same two named files |
| flexibility-task-switch | Input/tutorial ownership, spoken visible target and dark ink on yellow repaired; P/F, same two named files |
| spatial-coordinate-turn | Pause preserves earlier thinking; actual deadlines; explicit 45° instructions and named choices; S, `spatial-clock-regressions.test.tsx`, `spatial-presentation-regressions.test.tsx` |
| spatial-grid-nav | Measured active timing/stale direction guards; finite demo options/bounded scroll make actual tutorial choices reachable; S/U, `tutorial-layout.test.tsx` |
| spatial-mental-rotation | Input/deadline measured independently of poll; fractional before/at boundary and pause retained; S |
| spatial-fold-match | Actual active clock replaces fixed ticks; cue ownership, rounded display only, descriptive shape semantics; S |
| spatial-transform-match | Actual timing/ownership/rounded display; finite tutorial options and real demo candidate patterns without pre-answer verdict leak; S/U, `presentation-regressions.test.tsx` |

The thirteen P modules are GridRecall, ProspectiveCue, RunningOrder,
VisualSearch, SymbolTracker, FastMath, MissingOperator, ValueOrdering,
WordScramble, CardSort, CueShift, RuleFlip and TaskSwitch. The map above therefore
includes the paused-Next family as well as their later independent repairs.
Changed scoring/generator contracts were versioned; prior stored sessions retain
their versions. The final vector-only wave changes neither rules nor versions.

## Cross-product defect families

| Confirmed family | Current source/evidence disposition | Remaining acceptance |
|---|---|---|
| High stale restore preview/consent | REPAIRED: `app/data-management.tsx` binds exact text/mode/revision, rejects stale async completions including edit-back/file reload, disarms Replace confirmation, checks current explicit loss acknowledgment and applies displayed payload. D/Z49 tests PASS | Normal-UI write and actual text-edit invalidation still need conclusive native proof |
| Saved game stranded by workout advance failure | REPAIRED: `components/game-host/results.tsx` retry repeats only durable workout CAS with existing launch ownership; never replays session/reward persistence. Current `in-game-workout-actions.test.tsx`9 tests PASS in Z | Current-day full workout/continuation/restart native journey open |
| Skipped legs shown as played | REPAIRED: in-game and saved Results derive played/skipped counts from durable plan; before4/4, after3 played/1 skipped. Current caller9, `app/__tests__/results-workout-cta.test.tsx`5 and workout summary10 tests PASS in Z | Do not mistake next day's new0/4 plan for rollback of preserved prior2/4 |
| Reward/claim integrity through presentation changes | PRESERVED: transaction/ledger ownership, actual persisted reward values and partial-claim refresh remain. Z: result reward7, Profile purchases11, Rewards13, claim-all attacks16, achievement claim8 and quest claim7 tests PASS | Source/caller evidence is not final native restart/economy qualification |
| Discovery error painted as empty favorites | REPAIRED: explicit read error/retry; responsive discovery, early recommendations and filters implemented; W/Z | Actual error/keyboard/empty/populated and profile review remains bounded |
| Profile 37-achievement wall/raw progress/blank identity | REPAIRED in source: purpose-based disclosures, formatted count/percent, immediate essential identity rather than entrance. Preview03+later default frames show identity; original preview02 blank remains preserved and its precise cause unidentified | Current profiles/transition acceptance remains separate |
| Home/detail/Rewards hierarchy, cramped library | IMPLEMENTED: compact primary workout action, adaptive rows below 360dp or at large font, bounded original art, concise detail, responsive rewards and grouped preferences; W/Z, PRODUCT_AUDIT decisions | Full required profiles and actual composition critique |
| Progress metric/trend/calendar ambiguity | REPAIRED in presentation: five routes, rating separate from session performance, honest units/windows/bounds, slope 2 points/day, date/elapsed/UTC captions and endpoint labels; W/Z and PROGRESS_WAVE | Default endpoint scroll was independently observed in data05; complete current profile/state review remains separate |
| Sparse Results/overcelebrated weak outcome | REPAIRED: compact meaningful performance and saved continuation before facts; weak results suppress exaggerated reward treatment; PRESENTATION_RECOVERY/Z | Actual scored feedback/results and completion interactions |
| Data/recovery hierarchy and remote feedback | REPAIRED: early export/grouped operations, provider-free scrollable recovery; final feedback beside export/backups/import/wipe controls, same live-region/consent/write contract. D/Z | Native final feedback/write, keyboard/modal/recovery reachability |
| Functional glyphs/shared celebration typography | REPAIRED: AppIcon/Lucide check/close/time, partial ellipsis, FastMath submit/backspace, shared history/Spotlight; fixed badge geometry/labels/live regions retained. Shared celebration uses type roles/radius/viewport bounds. X/Z | Native 16–24dp appearance, contrast and large-text/reduced-motion review |

Paths in this table are relative to `apps/mobile/src/`. Functional control/status
icons are distinct from numbers, operators, letter/shape/direction stimuli,
ReactionTime's NO-GO cross, and cosmetic item/celebration emoji stored as product
data. Their continued presence is intentional, not an unresolved vector defect.

## Motion implementation and deliberate KEEP decisions

The existing shared `components/ui/motion.ts` is retained, not replaced by a
second engine. Unchanged useful implementation satisfies a KEEP decision; a
source diff is not required for every named motion category in the owner brief.

| Interaction | Actual current primitive/caller | Source evidence and runtime boundary |
|---|---|---|
| Navigation | Expo Router stack in `app/_layout.tsx`, consistent four-tab `components/app-tabs.tsx` | KEEP platform stack behavior; no new navigation animation engine. Actual navigation feel/profile coverage still needs runtime review |
| Cards/buttons/board presses | `usePressFeedback`, `components/ui/tappable.tsx`, shared Button/IconButton/card callers | Immediate callbacks; native-driver scale timing/spring; superseded/unmounted drivers stop; reduced-motion static pressed state. Z motion-cleanup3 tests PASS |
| Screen/content entrance | `useEntranceTransition` | Short native-driver opacity/translation with capped stagger and cleanup; children mounted immediately. Essential above-fold identity uses disabled entrance; no delayed gameplay eligibility |
| Game start | Shared press response plus immediate authoritative GameHost transition | Explicit KEEP: decorative entrance must not hide an already timed stimulus. Source absence of a separate start animation is not a missing feature |
| Answer/error/verdict | Actual caller owns acceptance/sensory claim; speed verdict pop components and shared color/shape/text feedback | ReactionTime/TapRush native-driver cues honor reduced motion; static verdict where timing clarity requires it. X and caller clock/input tests PASS; not every game needs a decorative animation |
| Progress/level | `useAnimatedProgress`, `ui/progress-bar.tsx`, `ui/animated-number.tsx`; Home/Profile XP bars | Animates changed targets, no wasteful mount-time sweep; optional numeric rerenders confined to small subtree. Progress driver is JS (`useNativeDriver:false`), unlike opacity/scale drivers. Stable level numeral is an explicit KEEP, not a missing level reward/parade |
| Saved results | `components/game-host/results.tsx` | Authoritative persisted rewards only; bounded native-driver entrance, weak-outcome guard and reduced-motion branch. Z results-reward7 tests PASS; presentation never grants XP/coins |
| Reward/completion | `rewards/celebration.tsx`, `workout/completion-summary-card.tsx` | Nonblocking banner, accessibility announcement, native opacity/static reduced-motion branch, cleanup/auto-dismiss; completion sensory cue once per workout key per JS session. Relaunch may present latest completion again; it does not re-award ledger value. Z celebration6 tests PASS |
| Timing/performance observability | `sdk/perf.ts` start-to-first-interaction marks and existing persistence/bootstrap spans | Instrumentation exists; game reaction clocks are observed active clocks independent of decorative motion. Instrumentation/tests do not establish actual latency, frame rate or memory acceptance |

The current Z run also passes3 reduced-motion preference tests. These tests prove
specific preference/cleanup/render contracts, not native animation smoothness,
screen-reader behavior, or a complete reduced-motion screenshot/interaction pass.
No additional concrete motion source defect is identified by this reconciliation.

## Task closure boundary and still-open work

| Task(s) | What this source reconciliation can truthfully support |
|---|---|
| 1.4 | Already checked: all 42 six-dimension source/caller assessments, explicit historical hypotheses and native limits |
| 6.1,6.2 | Source repair gates are satisfied for the confirmed ledger families: before/after regressions, real callers/siblings and versioning are recorded and Z passes. These are legitimate source-task closure candidates; closure must not imply 6.4 native acceptance |
| 4.1,4.2,7.1 | Shared system/motion implementation exists with explicit KEEP/refine decisions and passing callers. Source implementation can be recorded complete; perceived quality/native responsiveness is still governed by 4.4,5.7,7.2 and 8 |
| 3.4,6.3,6.5 | Vector convergence/all 42 presentation source/honest result and persistence caller portions are evidenced; small-size geometry, reachable boards, actual effects and runtime histories cannot be certified from source alone |
| 9.1,9.5 | Z is actual afabda3a composite/clean-checkout evidence, not an inferred self-test. Source/gate portions can be credited for that SHA; final clean main/integration and actual ending-SHA obligations still require root reconciliation |
| 1.3,1.5,3.5,4.3–4.4,5.1–5.7,6.4,7.2–7.3,8.1–8.4 | Complete route/state inventory, actual interactions, visuals/assets/keyboard/modal/large-text/reduced-motion/performance and independent critique require evidence beyond source. Implemented routes are not proof of every state |
| 9.2–9.4,9.6,10.1–10.3 | Final restore/workout/offline/restart/runtime/performance, ending-SHA four-workflow CI, visible Home handoff, final report and original-brief completion audit remain required |

At this record's boundary, NATIVE_PREVIEW06 documents the exact afabda3a APK,
successful build/install/device hash/permissions and SQLite byte preservation.
Its 180-frame matrix is still RUNNING; no completed profile verdict is borrowed
from that process. Earlier default captures and the repaired Grid tutorial are
valid for their recorded builds/profiles only. Update runtime disposition from
terminal evidence rather than this source summary.

Concretely still open: conclusive normal-UI Merge/Replace write and text-change
invalidation; current-day complete workout, scored continuation/relaunch and
offline gameplay; selective tutorial/input risk checks including compact/2x;
quiet startup/frame/memory/logcat; full current-profile image critique and
remaining state/accessibility reachability; final CI, clean main and visible
Home handoff. Data05's nine automatic outcomes were all INCONCLUSIVE; independent
data preservation/offline art/navigation observations do not become restore-write
or offline-gameplay PASS. The old provider400-cancelled two-leg journey is not a
completed workout.

Unreproduced historical hypotheses remain hypotheses: VisualSearch denominator,
SequenceMemory pause/quit exception, and controller-specific SymbolTracker Next/
CardSort/EquationBuilder tap/reachability concerns. WordChain distractor depth,
DeductionTable direct-elimination depth and VisualSearch's internal zero fastest
response sentinel remain bounded design/Low debt, not newly claimed repaired
mechanic bugs. The 90 seeded invariant probes cover first rounds at five levels
and six seeds for three games, not every possible generated session.

`PHYSICAL_ANDROID = NOT VALIDATED`; `IOS_RUNTIME = NOT VALIDATED`; x86_64 does
not prove ARM64; APK remains debug-signed and store signing NOT READY. Campaign 076
acceptance/history is unchanged. Current launch times measured under concurrent
load are observations, not quiet performance PASS. Owner taste approval still
requires the owner's personal review. Campaign 077 remains ACTIVE.
