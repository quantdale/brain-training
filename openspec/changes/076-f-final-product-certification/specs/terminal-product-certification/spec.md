## Purpose

Define the evidence, device, controller, and verdict rules required to end Campaign 076 without reopening its locked design or treating historical captures as terminal proof.

## ADDED Requirements

### Requirement: Locked product remains unchanged except for reproduced defects
Certification SHALL preserve the locked Training Studio direction, existing game mechanics, scoring, persistence, economy, workout ownership, offline behavior, registry semantics, and the already validated route matrix unless a reproduced defect requires a minimal correction. The project MUST NOT start a successor redesign or Change 077 as part of this certification.

#### Scenario: No defect is reproduced
- **WHEN** a reviewer wants a different visual treatment but no runtime defect is reproduced
- **THEN** production presentation, mechanics, and persistence remain unchanged

#### Scenario: A runtime defect is reproduced
- **WHEN** a current-device check reproduces a product defect
- **THEN** the correction is limited to that defect, includes a regression guard, and invalidates only evidence whose rendering or behavior dependency actually changed

### Requirement: Evidence provenance is explicit
Every game state and route used for acceptance SHALL have a provenance record identifying the game or route, state, source commit, APK identity, relevant production dependencies, capture or hierarchy identity, visual-review status, current applicability, and whether recapture is required. A frame SHALL NOT be labeled as a capture from an APK that did not produce it.

#### Scenario: Historical frame remains applicable
- **WHEN** the rendering dependency graph for a previously reviewed frame is unchanged
- **THEN** the record may classify it as source-equivalent historical evidence and MUST still state that it is not a capture from the terminal APK

#### Scenario: Historical frame is not terminal-APK evidence
- **WHEN** a frame was captured from any APK other than the terminal APK
- **THEN** the record MUST state `currentApplicability: false` for that row even when the frame remains a faithful picture of its surface

#### Scenario: Dependency changed
- **WHEN** an intervening change affects the board, game host, shared gameplay presentation, theme tokens, game rendering, game navigation, native configuration, or common runtime behavior represented by a frame
- **THEN** that frame is not accepted as current evidence and the affected state is recaptured or marked NOT VALIDATED

#### Scenario: Rendered closure changed
- **WHEN** the recorded change alters the rendered output of a surface a frame depicts
- **THEN** the generator MUST NOT label that frame source-equivalent, MUST record the named state `SOURCE_NOT_EQUIVALENT` with `currentApplicability: false` and `recaptureRequired: true`, MUST still emit the table, and MUST exit non-zero

#### Scenario: Change affects input handling only
- **WHEN** the recorded change alters hit-testing or another input behavior and not rendered output
- **THEN** rendered stills MAY remain source-equivalent history, every interaction claim drawn from them MUST be recorded as invalidated, and the generator MUST still exit non-zero while the dependency surface is dirty

#### Scenario: Effect of a changed file is not measured
- **WHEN** a file in the dependency-surface diff has no recorded effect
- **THEN** the generator MUST treat the effect as unknown, MUST NOT label any historical frame source-equivalent, and MUST exit non-zero

#### Scenario: Accepted route matrix is unchanged
- **WHEN** no relevant source change affects the reviewed 90-route matrix
- **THEN** certification preserves that matrix and does not regenerate it solely because certification resumed

### Requirement: Every registered game receives a current-device acceptance check
Certification SHALL inspect all 42 registered games on the current release candidate for active play, applicable scored feedback, pause and resume, final result, input responsiveness, visible instructions, board legibility, contrast and hierarchy, mechanic-specific behavior, and safe exit and return. A historical frame MAY support comparison, but it MUST NOT replace the required current-device check.

#### Scenario: Game acceptance is recorded
- **WHEN** a registered game is reviewed
- **THEN** its report records active, feedback, pause, result, input, and visual status as PASS, FIXED, NOT VALIDATED, or N/A with a justification

#### Scenario: Feedback is not inferred
- **WHEN** the only available image is an introduction, an unanswered board, or a file whose name contains feedback
- **THEN** that image is not counted as scored feedback unless inspection shows a scored or timeout outcome

### Requirement: Accessibility and layout coverage stays bounded to measured nodes
Certification SHALL cover default light, default dark, 2× text, compact viewport, normal or large viewport, reduced motion, and representative gameplay from all eight domains. Android interactive targets SHALL meet the 48dp floor. An audit that reports zero violations SHALL apply only to nodes actually measured; occluded, unmeasurable, or provider-limited nodes MUST remain separately classified.

#### Scenario: Route audit does not certify game controls
- **WHEN** an accessibility audit measures route components but not the active game controls
- **THEN** game-control reachability, labels, and target size remain unaccepted until those controls are measured

#### Scenario: Reduced motion is absent
- **WHEN** light, dark, compact, and enlarged-text route captures exist but reduced motion was not reviewed
- **THEN** the accessibility and layout acceptance requirement remains incomplete

### Requirement: Controller-led journeys are not substituted
Required stateful Android journeys SHALL be executed and inspected through the authorized external runtime controller. The required set is first-run onboarding, daily workout launch, active gameplay with scored feedback, interrupted workout and resume, standalone game completion, full workout completion, results and progress reflection, diagnostics or storage recovery, and applicable background or foreground interruption. A successful controller request that does not execute the journey MUST NOT be recorded as PASS. Host mouse, host keyboard, and gameplay-driving ADB automation MUST NOT be counted as the controller result.

#### Scenario: Credential is rejected
- **WHEN** the controller returns HTTP 401 or another persistent authentication failure
- **THEN** the affected journeys are BLOCKED_EXTERNAL, no credential or raw provider trace is stored in the repository, and independent repository checks continue

#### Scenario: Doctor reports ready
- **WHEN** the controller doctor reports ready but no authenticated task has executed
- **THEN** doctor readiness is not treated as authentication or journey acceptance

### Requirement: Clean-checkout certification matches the command that ran
The project SHALL run the repository's full clean-checkout certification procedure, not only its self-test, from a fresh checkout. A self-test pass MUST NOT be reported as composite certification. Gates that the certification script does not execute, including strict OpenSpec validation and Android artifact production, SHALL be recorded as separate results rather than implied by the script.

#### Scenario: Only the self-test ran
- **WHEN** the clean-checkout self-test passes and the full composite was not run
- **THEN** composite certification remains NOT VALIDATED

#### Scenario: Script omits a requested gate
- **WHEN** the full script passes but does not build an Android artifact or run strict OpenSpec validation
- **THEN** those omitted gates keep their own PASS, FAIL, or NOT VALIDATED classification

### Requirement: Terminal claims name their artifact
Every final acceptance claim SHALL identify the source SHA and APK identity that supports it. The terminal release APK SHALL be built from the terminal application source after permitted fixes. Mixed-build screenshots MUST NOT be described as captures from the terminal APK.

#### Scenario: A fix changes the APK
- **WHEN** a permitted UI or runtime fix produces a new APK
- **THEN** affected runtime surfaces are recertified and unaffected evidence retains its original artifact identity

### Requirement: Parent tasks close only with linked evidence
Each unchecked parent OpenSpec task SHALL be reconciled individually as DONE, BLOCKED_EXTERNAL, NOT VALIDATED, or FAILED. A task MUST NOT be checked unless linked evidence satisfies that task's acceptance criteria. Classifications MUST NOT be collapsed into a generic complete status.

#### Scenario: Evidence covers only part of a task
- **WHEN** some but not all states required by a parent task have been verified
- **THEN** that parent task remains unchecked and the missing prerequisite is named

### Requirement: Terminal verdict follows the weakest unmet gate
The certification SHALL use exactly one terminal verdict. Full validation requires every mandatory acceptance gate to pass, including controller-led journeys and applicable platform gates. Repository-complete with external blocker requires every independently executable repository-owned requirement to pass and every remaining gap to be an external dependency. Any unmet repository-owned acceptance gate requires the release-acceptance-blocked verdict.

#### Scenario: Controller remains externally blocked
- **WHEN** all repository-owned certification requirements pass and only an external controller or platform dependency remains blocked
- **THEN** the verdict is repository-complete with that external blocker named, and Android controller status and iOS runtime status are reported separately

#### Scenario: Game or checkout proof is missing
- **WHEN** game acceptance or full clean-checkout certification lacks proof
- **THEN** the verdict remains release acceptance blocked even if other gates are green
