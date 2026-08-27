# Design — Campaign 015 Governance & Depth Convergence

## 1. One active campaign, one executable contract

The repository already declares OpenSpec as the major-campaign execution
surface. Campaign 015 makes that convention enforceable.

For any non-null `.agent/GOVERNANCE.json.activeCampaign`:

```text
GOVERNANCE.activeCampaign
  == CURRENT_CAMPAIGN campaign id
  == STATE active campaign
  == active OpenSpec change directory/id
  == task-ownership change id
  == active execution prompt/change pointer
```

There MUST be exactly one executable ACTIVE campaign. A PROPOSED next change is
allowed to coexist as planning material, but it MUST NOT be reported as active
by governance or recovery state.

The validator must parse structured identifiers, not merely search for the
active ID as a substring in prose.

## 2. Campaign transition is an explicit state change

The transition from Campaign 014 to 015 is not an ordinary parallel work packet.

The orchestrator owns it and performs:

1. predecessor exit evidence complete;
2. predecessor terminal checkpoint written;
3. predecessor durable status becomes COMPLETED;
4. 015 `change.json` becomes ACTIVE;
5. governance `activeCampaign` becomes `015-governance-depth-convergence`;
6. CURRENT_CAMPAIGN/STATE/EXECUTION prompt point to 015;
7. task ownership is replaced with a 015 packet map rooted at real repository
   paths;
8. repository/OpenSpec/ownership validators pass before feature work starts.

If the predecessor is not complete, stop the transition and leave 015 PROPOSED.

## 3. Active OpenSpec integrity is unconditional

`validate-repo-state.mjs` must not depend on whether the expected change
directory happens to exist.

For every active campaign it MUST require:

- `openspec/changes/<id>/change.json`;
- matching `change.json.id`;
- `change.json.status == ACTIVE`;
- proposal, design, tasks, execution entrypoint, audit map;
- each declared normative spec;
- predecessor/transition consistency where applicable.

Remove one-off campaign-specific exceptions.

## 4. Ownership validation proves the active plan

`.agent/task-ownership.json` remains a useful machine-readable swarm contract,
but it must describe the current active change.

Validation MUST check:

- `change` equals governance active campaign;
- packet IDs are unique;
- dependencies reference real packet IDs and are acyclic;
- coder surfaces are repository-root-relative and resolve to plausible current
  architecture paths;
- no two parallel coder surfaces overlap unless explicitly serialized/shared;
- coder surfaces do not intersect orchestrator-only surfaces;
- coder surfaces do not intersect generated-file patterns;
- shared surfaces cannot silently grant two coders concurrent write ownership;
- each packet declares cheap completion validation.

Protected/generated checks must use surface intersection semantics. A broad
`apps/mobile/src/**` claim must be rejected if it contains an
orchestrator-only/generated path, even when the literal glob string does not
match that protected pattern.

## 5. Durable state is parsed, not trusted as prose

Campaign identifiers/statuses used for recovery should be represented in a
small machine-readable state file or parseable frontmatter/metadata, while
human Markdown remains descriptive evidence.

Campaign 015 may introduce a minimal `.agent/state.json` (or equivalent) only if
it reduces ambiguity without creating a second authority. If introduced, it is
derived/validated against GOVERNANCE/OpenSpec and documented in AGENTS.md.

The key property is one canonical identifier/status with validators proving all
human recovery documents agree.

## 6. Root hygiene is narrow

Do not ban zero-byte files repository-wide; tests/fixtures may legitimately use
them.

Instead, validate repository-root entries against a small explicit set of
expected files/directories plus documented extension points. Suspicious
unexpected root files—especially empty shell-redirection residue—must fail with
an actionable message.

## 7. Affected-area validation follows current architecture

`validate-affected.mjs` should continue to be risk-based rather than exhaustive.

Add explicit areas for current high-level subsystems such as:

- workout/personalization/mastery/spotlight;
- sync/data-portability;
- content/registry/provenance;
- assistant/entitlements where present;
- OpenSpec/campaign governance.

Campaign task packets declare their changed surfaces and owed checks. The tool
may produce a machine-readable plan; CI need not run Android for every commit.

## 8. Logic Rule Grid becomes chained deduction

The current Latin-square one-blank mechanic is replaced or extended by a puzzle
model with explicit constraints and multiple unknowns.

A generated puzzle MUST include:

- a complete hidden solution;
- a clue/visible-cell set;
- one unique solution under the exact player-visible rules;
- a solver trace or equivalent proof of uniqueness;
- a measured deduction depth.

For Hard/Expert, at least one required answer MUST depend on a fact that itself
must first be derived from another clue/constraint. Merely placing multiple
independent one-step blanks does not satisfy chained deduction.

Difficulty should scale inference depth/constraint interaction in addition to
board size/time.

The final generator boundary validates uniqueness and minimum depth before
return. Bounded generation exhaustion must regenerate/fail deterministically,
not silently return a weaker puzzle.

## 9. Language content grows with quality gates

### 9.1 Word Chain

At least 90 chains, with a target minimum of 30 per tier.

Validation covers:

- declared count equals actual count;
- stable unique IDs;
- every adjacent link follows the game's exact chaining rule;
- no duplicate chains;
- near-duplicate/reordered-chain detection;
- tier-appropriate length/complexity constraints;
- adequate decoy diversity.

### 9.2 Context Fit

At least 60 items per tier (>=180 total).

Validation covers:

- stable unique IDs and correct declared count;
- exactly one accepted answer;
- distinct distractors;
- no answer duplicated as distractor;
- basic morphology/part-of-speech compatibility so distractors are not
  eliminable solely by grammar;
- deterministic selection;
- curated semantic review fixtures for ambiguous/high-risk items.

Pack/content version advances and registry/provenance metadata are updated
through existing supported paths.

## 10. Transform Match validates semantics at final return

The final generated round validator MUST prove:

- source density/indices are valid;
- chosen transform is meaningful under the round rules;
- correct option equals the chosen transform result;
- options are distinct;
- requested option count is satisfied for every production profile;
- hidden-source presentation does not make two displayed options equally valid
  interpretations of the stated task;
- near-duplicate guards are respected where required.

No fallback may bypass an invariant merely because the attempt budget expired.
If a candidate space is impossible, the generator must choose a deterministic
supported fallback profile or fail loudly in development/tests; production
profiles must be proven feasible by property sweeps.

Generator semantics change => generator version bump.

## 11. Evidence-driven performance only

Campaign 015 does not perform speculative optimization.

For affected hot paths:

1. capture a baseline using existing opt-in probes;
2. run the implementation;
3. capture the same probe after convergence;
4. record dataset size/device/runtime context and result;
5. optimize only where evidence justifies it.

Statement-count guards remain useful but are not equivalent to wall-clock or
interaction-latency evidence.

## 12. Accessibility follows changed semantics

Reuse the existing shared focus, announcement, reduced-motion, font-scale and
semantic-label primitives.

Changed puzzle cells/options must expose enough information for equivalent
interaction without encoding the answer in accessibility text.

Accessibility validation must distinguish:

- unit/static semantic checks;
- Android device/accessibility-tree evidence;
- manual/system UI evidence;
- iOS NOT VALIDATED on a Windows-only host.

## 13. Validation strategy

Layered evidence:

1. repository-state/OpenSpec/ownership validator unit tests;
2. deterministic generator/content validators and many-seed property sweeps;
3. targeted app/unit/integration tests for changed systems;
4. full Jest/typecheck/lint at convergence;
5. registry/provenance/offline/QA self-test;
6. web export and Expo Doctor when convergence reaches final gate;
7. dedicated project AVD journeys for changed gameplay/workout surfaces;
8. GitHub App CI + Repository Integrity green on the final pushed SHA.

No blind retries, no borrowed foreign emulator, no fake green.

## Current-head design correction: workout attribution

The August 27 re-audit found that workout completion routing currently solves identity through timing: `findActiveInstanceForGame(gameId, completedAt)` searches active instances and the result hook applies a second timestamp guard. The new 10-second tolerance made first-leg device behavior more permissive but broke the repository's historical/equal-timestamp safety tests and App CI.

Campaign design now treats workout ownership as a causal provenance problem:

1. establish one authoritative identity for the workout instance (existing instance key is a natural candidate);
2. carry ownership/leg provenance through the launch boundary into the persisted session or an atomically associated record;
3. route results using that provenance, not newest-matching-game heuristics;
4. make repeated processing idempotent at the durable boundary, not only with React refs/local state;
5. migrate old databases/data-portability formats compatibly; legacy sessions without provenance remain displayable but cannot ambiguously advance workouts;
6. eliminate duplicated timing constants/heuristics once causal attribution is established.

Implementation details may differ if a simpler invariant proves all normative scenarios. Any schema change requires migration, round-trip/export-import, rollback/failure, and legacy fixtures. Do not widen the schema merely because it is convenient; choose the smallest design that proves ownership.

### Implemented attribution invariant (current tree)

The authoritative ownership tuple is `(instanceKey, legIndex, gameId)`: `instanceKey`
is the persisted `WorkoutInstance.date` key (bare date for daily workouts or the
namespaced template key), and `legIndex` is the zero-based position selected at
launch. Workout links encode that tuple as `workoutKey`/`workoutIndex`; the game
route validates it and provides it to the shared `useGameSession` host. The host
associates the generated session id with the tuple, and the single session DB
boundary atomically embeds it in `rawResult` under the reserved
`workoutProvenance` key. Reads reconstruct the typed provenance from that JSON,
so results reopening, backup round-trips, and process relaunch do not depend on
React refs or route state.

`findActiveInstanceForSession` and the conditional `advanceForSession` transaction
require the exact tuple, the same current leg, the matching game id, and the
active row version. Only the transaction that changes that row returns
`advanced: true`; duplicate delivery, stale hook state, re-view, or a concurrent
owner therefore cannot move a leg twice. Legacy/standalone sessions without the
reserved tuple remain readable/displayable and are never eligible for advancement.
No timestamp, recency ordering, or positive grace interval participates in
ownership.

### Harness principle

QA wait budgets are diagnostic/recovery mechanisms, not correctness. For workout flows, record time-to-template-ready/time-to-durable-completed state and classify timeouts. A longer sleep/poll is not an acceptable substitute for a missing state notification or stale persistence read.
