# CAMPAIGN 077 — FRONTIER PRODUCT REBUILD REPORT

**Status: ACTIVE — factual draft, 2026-10-15.** Implementation and current-source
engineering checks have materially advanced. Final device acceptance, ending-SHA
CI and the owner handoff remain open. This report must be finalized against the
actual terminal evidence before Campaign 077 can be called complete.

## Repository

| Field | Evidence at this draft |
|---|---|
| Repository / canonical branch | `quantdale/brain-training`, `main` |
| Starting SHA | `c7bbf0ddfa184204027d8b6df14deab5abf87a6e` |
| Current certified application source | `afabda3a74201d3bbd7da22da9d0ecbf99bf7878` |
| Ending SHA | **PENDING — fill after all authorized implementation/evidence work and the final coherent commit.** Current source is an intermediate checkpoint. |
| Worktree state | One linked worktree on `main` was observed. The lead has active documentation/capture-harness changes; this draft adds an evidence file. Final clean status and pushed `origin/main` identity are **PENDING**. |

The seven campaign commits through the current source are:

| Commit | Coherent progress |
|---|---|
| `918c20ed` | Establish Play Lab and repair game correctness |
| `ebcb45e8` | Record integrated gates and committed-source Android preview |
| `8d772c7b` | Converge measured game input and readable Progress |
| `5df95a3a` | Align UI smoke contracts and record native preview03 |
| `95e38eac` | Simplify saved results and repair clipped spatial tutorials |
| `d164420d` | Clarify Progress metrics and qualify the repaired native tutorial |
| `afabda3a` | Unify game status vectors and expose operation feedback |

Independent certification clones and `D:/bt077`, the native build copy, are
separate from linked Git worktrees. Their retained artifacts and cleanup limits
are recorded in the repository state. Pre-077 control-plane files remain
byte-preserved under `.agent/history/pre-077-c7bbf0dd/`. Campaign 076's historical
blocked verdict and open parent 14.3 are retained.

## Research

Actual Refero research used style search/full-style retrieval, mobile screen
search/details, full screenshot retrieval and flow search/details:
`refero_search_styles`, `refero_get_style`, `refero_search_screens`,
`refero_get_screen`, `refero_get_screen_image`, `refero_search_flows` and
`refero_get_flow`. The persisted raw records explicitly identify the
`mcp__refero__refero_get_style` and `mcp__refero__refero_get_screen` calls.
The [reference lock](ART_DIRECTION.md), [raw styles](refero-styles.json),
[saved mobile response](refero-mobile.json), [data/empty-state supplement](refero-data-empty.md)
and [Progress research record](PROGRESS_WAVE.md) distinguish saved responses
from additional calls retained in the research agents' tool history.

| Reference examined | Exact reference | Lesson adopted |
|---|---|---|
| Quizlet full style | `d6523b05-a53f-4a2a-8829-d65a5c3724e9` | Cool near-white canvas, compact spacing, readable hierarchy and bounded learning media |
| Headspace full style | `c73224da-e583-4833-bf39-3f414c317474` | Blue as interaction/selection emphasis within the dominant cool system |
| mono full style | `4b3c372c-aff6-4608-bafb-1dde853c4805` | Mechanic precision considered; severe monochrome/condensed styling rejected |
| Brilliant Home / intro | `bb9874e6-1e7e-42a5-bd1a-9ba444f9180e`; `7f9cd6c0-640d-484a-b34b-f55218b0561f` | Compact habit context, action before plan and concise first-play teaching |
| Imprint Explore | `a576c74f-bd8d-4ce1-9ad0-122fe535e084` | Distinct media with native, readable titles outside artwork |
| Brilliant selection / lesson flow | `677e7d1f-74e7-42e9-bbb4-e072f4257e03`; flow `4323` | Clear task/input/feedback sequence; reduce repeated reward screens |
| Duolingo results / profile | `aa871eca-62d2-4e49-bbf2-0ce2c16bd879`; `d53d927f-ab99-4009-8fea-1acc4c3da3ee` | Concise earned result facts and understandable metric context |
| Duolingo settings / quests | `47863818-0748-4226-9349-39428c1d3140`; `b489253b-897f-46b2-a97b-351929697587` | Purpose-grouped preferences and visible reward endpoints |
| FocusPomo operation history / IFTTT empty activity | `2b92e90f-8044-43ad-85a0-0c5b64e8ee60`; `42bf3e8e-5ac4-46cb-a38a-502cfdc46c9f` | Operation feedback beside its controls; distinguish empty, loading and failed reads |
| Clearful light/dark Progress / GrowPal History | `c97a590a-59aa-4206-86f1-e6456f051ac7`; `0bdd9604-5207-419b-b21d-9d03cab7b0fb`; `37f05fa5-6918-4934-b8ed-239c4272f6dc` | Direct metric context, primary summary and scannable history |

The initial research compared four style-search directions and three full styles.
The independent product research recorded 26 screen/flow calls and nine inspected
images; the later Progress supplement recorded six successful calls and three
inspected full images. These are separate recorded activities, not a deduplicated
total call count. Elevate/Peak searches returned adjacent products and do not
establish examined references from those apps. Mislabeled feedback results were
rejected after image inspection.

**Selected direction: Play Lab**, an internal visual direction rather than a
public product rename. Its compact daily-action hierarchy, cool light/deep-navy
themes, original matte learning objects, Manrope type and one functional vector
family fit the colorful 42-game collection. Quizlet supplies the dominant
foundation; Headspace contributes bounded blue interaction emphasis. Existing
domain and success/warning/error roles remain distinct.

Three actual ImageGen concept sheets were compared and independently critiqued:
[Play Lab](directions/play-lab.png), [Puzzle Index](directions/puzzle-index.png)
and [Curiosity Club](directions/curiosity-club.png). Puzzle Index's precise boards
were useful, but its severe condensed monochrome treatment was rejected.
Curiosity Club's cohesive art was attractive, but its action appeared too late
and result artwork dominated. Play Lab's repeated candy-cube/trophy treatments,
invented metrics and incorrect numbered-path example were also rejected. None
of these generated mockups is shipped UI or proof of game correctness.

## Visual assets

ChatGPT ImageGen was available and actually called **17 times**: three direction
explorations and 14 preserved raster-source generations/edits. The 14 source
PNGs contain ten accepted sources and four rejected earlier drafts. Accepted
sources supply the Home assembly, Memory, Attention, Speed, Math, Language,
Logic, Flexibility, Spatial and the original interlocking app mark.

Rejected drafts remain preserved: Logic v1's loose tile did not coherently fit
its pictured path; Speed v1's metallic finish broke the matte family;
Flexibility/Spatial v1 did not respect their established domain hues. Actual
ImageGen edits produced the accepted replacements. Prompt records are the
`asset-prompts-*.json` and `asset-prompt-*-v2.json` files in this evidence folder.

The deterministic [asset manifest](../../../../docs/redesign/artwork/campaign077/manifest-initial.json)
records sources, SHA-256 values, output sizes, transparency, preparation methods
and licenses. Its 17 output records comprise nine illustrations, five branding
derivatives and three fonts; that output count is distinct from the 17 ImageGen
calls. Original generated sources remain in
`docs/redesign/artwork/campaign077/sources/`.

| Bundled illustration | Source bytes | Optimized bytes |
|---|---:|---:|
| Home workout assembly | 1,414,045 | 139,461 |
| Memory | 1,025,820 | 116,872 |
| Attention | 867,706 | 119,406 |
| Logic | 1,123,114 | 140,233 |
| Math | 1,115,399 | 117,811 |
| Language | 753,599 | 124,844 |
| Speed | 819,723 | 108,669 |
| Flexibility | 983,061 | 114,140 |
| Spatial | 530,396 | 103,348 |
| **Nine illustrations** | **8,632,863** | **1,084,784** |

Visible-alpha cropping and aspect-preserving Lanczos preparation produce
transparent 512×512 illustrations, about **87.4% smaller** in aggregate than
their accepted source PNGs. Five launcher/adaptive/monochrome/splash/favicon
derivatives total 528,416 bytes; all 14 bundled image outputs total
**1,613,200 bytes**. Three locally embedded SIL OFL Manrope weights
(400/600/700) total 292,428 bytes. Fonts were derived from the licensed font
source, rather than generated by ImageGen. Initial light/dark composites were
inspected; the manifest's initial acceptance wording is not a final native gate.

Preview06's packaged-asset check confirms all nine illustrations are
pixel-identical after Android resource processing and all three fonts are
byte-identical. Their combined decoded RGBA footprint is 9,437,184 bytes if all
nine images were resident; actual process memory still requires measurement.
The current 52,309,219-byte APK is larger than the 48,888,528-byte baseline;
image optimization does not establish an overall APK-size or performance win.
See [preview06](NATIVE_PREVIEW06.md).

Lucide/SVG through the existing `AppIcon` now supplies navigation, operations,
controls and functional status icons across **42/42 games**, including correct,
wrong, timeout, partial, FastMath backspace and submit. Native puzzle symbols,
operators, directions and Reaction Time's NO-GO cross remain game content.
Existing cosmetic data remains separate. No additional icon or motion engine
was introduced. Details and initial fixture failures are preserved in
[status convergence](STATUS_CONVERGENCE.md).

## UI/UX

The product audit inspected all **15 shipping leaf routes**, the development
prototype and their shared components. Fresh baseline evidence contains 150
structural frames: 15 routes in two directly witnessed themes, with default,
compact, font-scale-2, expanded and reduced-motion profiles. This establishes
the recorded routes/states; it does not cover every game transition.

| Screen/family | Classification and resulting treatment |
|---|---|
| Home / workout | REDESIGN: compact habit/progression context, one useful workout action before the plan, bounded original art and honest saved completion |
| Games | REDESIGN: earlier discovery/recommendations, clear search/filter/read failures and compact/large-text row reflow |
| Game detail | REFINE: differentiated identity and concise mechanic introduction; retain difficulty, start and provenance ownership |
| Game / tutorials | REDESIGN shared presentation: wider quiet stage and coherent HUD/feedback; repair mechanic-specific geometry and tutorial reachability |
| Results / workout completion | REDESIGN: concise truthful performance/rewards, saved continuation before detailed facts and an advance retry |
| Progress overview | REDESIGN: overall rating first, explicit performance/rating distinction, useful trend/activity/domain context |
| Progress detail | REFINE: preserve transparent metric interpretation/history with clearer hierarchy |
| Progress activity | KEEP/REFINE: retain useful calendar/frequency visualization; clarify dates, counts, UTC buckets and elapsed-time copy |
| Progress domain | REFINE: readable history, selected-window state, correct units and numeric endpoints |
| Progress game | REFINE: preserve records/version context; wrap essential facts and disclose comparison windows |
| Rewards | REDESIGN: responsive collection, distinct earned states and clearer claim hierarchy |
| Profile | REDESIGN: readable identity/XP and purpose-grouped preferences, appearance and data |
| Data management | REBUILD presentation and repair stale-preview safety: explicit decisions/consent, compact actions and nearby operation feedback |
| Storage unavailable | REFINE: retain recovery-safe backup path; improve readable action hierarchy |
| Bootstrap recovery | REFINE: retain classified failures/retry; make provider-free recovery scrollable at large text |

Preserved strengths include atomic SQLite/session/economy/workout contracts,
offline local loading, safe back fallbacks, opaque fair pause, seeded game
identity/provenance, existing records, transparent performance bands,
calendar/frequency visualization and shared press feedback. No entire unchanged
screen is claimed as a redesign deliverable.

Shared work includes palette/contrast/type tokens and `ThemedText`, buttons and
rows, four-tab navigation, original discovery media/game identity, GameHost
stage/HUD/results presentation, bounded recovery/tutorial layouts and operation
icons/feedback. Existing press, entrance, verdict, progress and earned-result
cues retain reduced-motion gates. Level numerals remain stable while the
existing XP bar animates; immediate timed-game start is preserved. Native motion
and performance acceptance remain pending.

Before/after evidence is indexed by [product audit](PRODUCT_AUDIT.md),
[Progress wave](PROGRESS_WAVE.md), [presentation recovery](PRESENTATION_RECOVERY.md)
and previews [01](NATIVE_PREVIEW01.md), [02](NATIVE_PREVIEW02.md),
[03](NATIVE_PREVIEW03.md), [04](NATIVE_PREVIEW04.md), [05](NATIVE_PREVIEW05.md)
and [06](NATIVE_PREVIEW06.md). Local PNG/XML/manifests are under
`qa-artifacts/campaign077/`. Preview05's 36 default-theme frames were all
independently viewed, with no new P1/P2 in those first viewports. Root also
inspected the scrolled 988→945 Attention rating endpoints in the Data05 trace.

**Current visual acceptance: PENDING.** Preview06's 180-frame matrix is running
(18 surfaces × two themes × five profiles). Terminal manifest checks and actual
image critique must complete. Compact/expanded baseline and current widths
differ, so they support responsive-family comparisons rather than matched pixel
pairs. Baseline six sessions/completed 4/4 and current eight sessions/new-day 0/4
are different states and must remain disclosed.

Remaining visual risks include current compact/2× tutorial/feedback acceptance,
the previously intermittent Profile blank frame's unknown original cause
(mitigated and absent in later default reviews), and the preview05 first-play
sheet's thin blue seam (P3). The failed compact framebuffer-resize capture and
blocked clipped tutorial evidence remain retained. The source fixes and later
default/tutorial witnesses do not complete the new full-profile gate.

## Games

**42/42 games assessed** across mechanics, scoring, input, lifecycle,
presentation and accessibility. The [42-row audit](GAME_AUDIT.md), its later
superseding convergence table, and the [defect ledger](DEFECTS.md) are the
per-game record. All 42 also had the bounded functional-status consistency
correction. The confirmed correctness findings vary in kind and severity;
these source/caller findings do not assert 42 native failures or playthroughs.

| Confirmed defect family / affected examples | Implemented correction |
|---|---|
| Adaptive Code Cracker; Rule Grid | Atomic adaptive secret/profile length; exact row/column geometry, asked-cell marking, chained deduction and deadline eligibility |
| Memory, Pattern Tap Back, Sequence Memory | Render the generated sequence rather than ordinal cell indices; preserve valid rapid recall while deduplicating physical delivery |
| Grid Recall, Pair Recall, Running Order, Prospective Cue, Symbol Tracker, Visual Search, Vigilance | Measured exposure/onset, correct pause remainders, rendered cue/session ownership and stale/duplicate guards |
| Tap Rush | Authoritative target deadlines and shared measured render/hit geometry; previous timers cannot expire a new target |
| Odd One Out, Target Count, Color Stroop, Reaction Time, Color Match | Pause-excluded response measurement, actual deadline checks, retired timeout ownership and correct-only response averages |
| Quick Compare, Order Sweep, Word Chain and continuation siblings | Early-wake rearming, current cue/step ownership and silent replay rejection; distinct known-sequence inputs remain valid |
| Equation Builder; Number Line | Standard precedence/exact arithmetic and measured active clock; numeric target with hidden answer location, adjustable draft and explicit submit |
| Word Match; Context Fit; Next in Sequence | Correct concrete ambiguous/wrong items and explanatory copy, with versioned content/generator metadata |
| Sentence Builder; Order Path | Honest partial credit without a completed-sentence pass/streak; actual tap counts; already placed cells cannot add a mistake |
| FastMath, Missing Operator, Value Ordering, Word Scramble, Deduction Table | Synchronous staged input/answer claims, exact cue/pause/deadline ownership and one-shot tutorial choices/completion |
| Card Sort, Cue Shift, Rule Flip, Task Switch | Current rendered input/sensory claims, clear readiness and visible-only target semantics; readable on-fill contrast |
| Coordinate Turn, Grid Navigator, Mental Rotation, Fold Match, Transform Match | Preserve pre-pause thinking time, actual deadlines, readable rounded display, descriptive choices and bounded accurate tutorial boards |

Meaningful scoring/generator/content changes carry new metadata; persisted
historical results retain their original versions. Status-vector convergence
changes no rules, clocks, versions or economy. Workout/data repairs separately
bind preview/consent to exact text/mode/revision, retry the durable workout
advance without replaying session rewards, and count skipped legs honestly.

Git's `c7bbf0dd..afabda3a` added-file diff contains **79 mobile test files**,
77 under game modules, alongside strengthened existing tests. These cover
rendered stimuli, caller batching/duplicates, fractional deadlines, pause and
tutorial ownership, independent arithmetic/solver checks, partial outcomes,
content meaning, contrast/semantics and layout. Representative fail-before
records include 39 paused-continuation probes, 28 flexibility caller probes,
30 memory/search failures with two controls, and 28 tutorial failures with five
normal controls. Packet counts overlap and are not summed into a new total.
The final clean-checkout aggregate is reported below.

Unvalidated states remain explicit: comprehensive current-APK 42-game journeys,
all games at enlarged text, full TalkBack/VoiceOver, interruption cases,
complete current-day workout/resume and offline gameplay. Historical Visual
Search's alleged completed 0/6 denominator was not reproduced; the actual
completed test produced 0/12. It is not reported as a newly fixed bug.

## Quality

The current-source results below are bound to `afabda3a`. Final ending-SHA
reconciliation remains **PENDING** if source changes again.

| Check | Current evidence and limit |
|---|---|
| Typecheck | PASS in the actual independent afab clean-checkout composite |
| Lint | PASS, full-source zero-warning ESLint in that composite |
| Jest | **702 suites / 7,903 tests / 5 snapshots PASS**, 382.226s; four suites/five explicitly reviewed opt-in tests skipped, zero failures; classifier PASS |
| Clean checkout | PASS, independent `D:/bt077-cert-afabda3a`, fresh dependencies, no inherited native folders, unflagged `node scripts/certification/certify-clean-checkout.mjs`, clean tracked state after execution |
| OpenSpec | Strict 62-item validation PASS; artifact validity does not close unfinished campaign acceptance tasks |
| Repository contracts | Registry/provenance, ownership, offline/secrets, runtime-QA, Expo alignment, workflow and affected-map gates PASS in the composite |
| Dependency/security | Production audit PASS with ten accepted advisories and no new unallowlisted moderate-or-higher production finding; existing debt remains disclosed |
| Web | 22-route export exits 0; retained Expo forced-exit housekeeping message is not evidence of clean process teardown |
| Android build | Preview06 Gradle release PASS, 532 tasks, 2m36s; x86_64/debug-signed, eight packaged permissions match the allowlist |
| Emulator runtime | **PARTIAL / PENDING current final acceptance** — observed journeys and limits below |

The independent clean-checkout identity and copied Jest summary are retained
locally as `clean-checkout-afabda3a-identity.json` and
`clean-checkout-afabda3a-jest-summary.json`; summary SHA-256
`d81ef4c6c3414129f8dcf1d5c3724a69ce91927b097932b9ae4a389d27b93f31`.
See [preview06](NATIVE_PREVIEW06.md) for the full composite boundary. This run
includes the final inline operation-feedback correction. Earlier whole-Jest06
predated that correction and is not substituted for this clean-source run.

Initial failures are retained: stale guide/metadata/layout fixtures, C's
unsupported RNTL query APIs and test typing/unused imports were repaired and
rerun. Those fixture failures are not app-bug reproductions. The older whole-run
worker forced-exit warning remains unexplained; it was absent in the current
clean-checkout log. npm deprecations, Expo housekeeping and Node DEP0190 warnings
remain recorded. Existing dependency debt is governed by
[the dependency record](../../../../.agent/DEPENDENCY_AUDIT.md).

Runtime evidence has narrower boundaries:

- The earlier actual online Pro workout saved two games and returned Home at
  2/4, 186 XP/49 coins. A clipped Grid Navigator tutorial blocked leg 3; the
  provider later returned a malformed-history 400 and the task was stopped
  CANCELLED. It is not a completed workout.
- On preview04, Flash completed the repaired Grid Navigator tutorial through
  normal choices/Done without QA skip. Root inspected the actual frames; the
  real game was not started in that smoke.
- [Data05](RUNTIME_DATA05.md) completed 107 steps, but all nine automated
  assertions were INCONCLUSIVE. Independently inspected frames show keyboard
  interaction, invalid JSON rejection, backup save/load, Merge/Replace previews,
  armed consent and scrolled rating endpoints. Successful same-data Replace
  write and an actual text-change invalidation event remain **PENDING**.
- Network-off relaunch/navigation retained local artwork and saved screens in
  Data05. Actual offline gameplay remains **PENDING**. Original connectivity was
  restored and checked. Post-task SQLite integrity/counts/settings were preserved.
- Preview06 installation preserves exact SQLite db/wal/shm bytes; a separate
  verification copy has integrity `ok` and eight sessions. This proves install
  preservation, rather than a restore write or a full device journey.
- Quiet launch/memory/frame/logcat qualification is **PENDING**. Preview05's
  13,195ms launch/14.7s timeout and preview06's initial 6,668ms cold launch were
  under concurrent validation load; no accepted performance improvement is
  inferred from them.

ARTEMIS provider access was restored by loading the authorized external `.env`
before inherited settings, without changing the provider/model or exposing
credentials. External traces remain under `D:/Tools/artemis` and are not copied
into Git. Doctor/configuration readiness alone is not runtime task acceptance.

## GitHub Actions

**Exact ending SHA: PENDING. Latest ending-SHA run IDs/results: PENDING.**
The lead must verify all four required workflows against the same final SHA.
No previous green checkpoint is a replacement for that gate.

| Required workflow | Final run ID / result | Earlier verified checkpoint at `95e38eac` |
|---|---|---|
| App CI | **PENDING** | [38646019805 — SUCCESS](https://github.com/quantdale/brain-training/actions/runs/38646019805) |
| Repository Integrity | **PENDING** | [38646020047 — SUCCESS](https://github.com/quantdale/brain-training/actions/runs/38646020047) |
| Android Build Smoke | **PENDING** | [38646020100 — SUCCESS](https://github.com/quantdale/brain-training/actions/runs/38646020100) |
| iOS Build Smoke | **PENDING** | [38646019749 — SUCCESS](https://github.com/quantdale/brain-training/actions/runs/38646019749) |

These earlier IDs are preserved in [preview04](NATIVE_PREVIEW04.md). Current
afab/final CI status was not queried by this report packet. iOS compile success
does not establish iOS runtime evidence.

## Device handoff

| Field | Current identity / final handoff status |
|---|---|
| Visible GUI | Dedicated visible emulator recorded; fresh final visible/unminimized witness **PENDING** |
| AVD / serial | `braintraining-ui35` / `emulator-5570` |
| Installed source | `afabda3a74201d3bbd7da22da9d0ecbf99bf7878`, preview06 |
| Installed APK SHA-256 | `079b7e520e347c9856e40082177505da742ee27948527abccf4ebdca6d05ffad` |
| APK / package / version | 52,309,219 bytes; `com.braintraining.app` 0.1.0 / 1000; x86_64; target SDK 36; debug-signed release |
| Build inventory | 1,107 exact committed files; SHA-256 `9c920440a6ac82cfe3837de08b1d610d847c9859b6884fb56f6efdbdc72c9188`; zero source differences |
| Packaged-source corroboration | 941 mapped own source files and all 56 changed production files match committed bytes; packaged Hermes bundle matches the generated bundle |
| App foreground state | **PENDING final Home-at-top witness after all runtime work.** Active profile capture is not the final handoff. |
| Screenshot evidence | Baseline and preview galleries retained locally; preview06 180-frame capture/review and final Home screenshot are **PENDING** |

Build/install/theme/source-map/asset proofs are indexed in
[preview06](NATIVE_PREVIEW06.md) and its local artifact directory
`qa-artifacts/campaign077/native-preview06/`. Runtime automation stays
emulator-local; no host mouse/keyboard/focus automation is used. No additional
emulator is needed for this report.

## Final assessment

The product has a coherent original visual system, useful daily-action and
discovery hierarchy, readable progress/records, truthful saved results,
purpose-grouped preferences/data, bounded original local assets and one
functional icon family. Concrete game correctness and input/timing defects,
stale restore consent, workout advance recovery and native tutorial clipping
have corresponding source/caller repairs and versioned evidence.

No remaining confirmed High/Critical **source** defect is identified by the
latest 42-game reconciliation. Current device acceptance remains incomplete.
The unknown original Profile blank-frame cause, old teardown/performance
observations, current profile/tutorial risks and unproven restore write are
retained rather than silently closed. The owner still needs to review the
rebuilt application personally; tests and generated artwork cannot supply taste
approval.

**Release verdict: ACTIVE / FINAL ACCEPTANCE PENDING.** Physical Android and
iOS runtime are **NOT VALIDATED**; ARM64 is unproven and Play Store signing is
**NOT READY**. The current emulator APK is not a store-release artifact.

To finalize this report, the lead must record:

1. Terminal preview06 profile manifests and independent actual-image critique,
   including current compact/2× tutorial/feedback checks and any repairs.
2. Conclusive normal-UI restore write/text-change safety evidence, complete
   current-day workout/resume and actual offline gameplay with preserved data.
3. Quiet current-source startup/memory/frame/logcat measurements and conclusions.
4. The true ending SHA, any required rerun after later source changes, all four
   exact-SHA CI IDs/results, clean pushed `main` and retained-artifact state.
5. Fresh visible GUI/Home-at-top screenshot and identity witness, explicit
   remaining defects/platform limits and owner-review status.

Until those entries are reconciled, this document is a recovery-ready draft
covering the required section 17 fields, not a campaign completion claim.
