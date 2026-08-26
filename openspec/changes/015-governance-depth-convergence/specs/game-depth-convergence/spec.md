# Game Depth Convergence — Delta Spec

## ADDED Requirements

### Requirement: Rule Grid supports solver-proven chained deduction

Rule Grid Hard and Expert puzzles MUST require at least one dependent deduction:
a required fact cannot be obtained directly from the initially visible state
without first deriving another fact or constraint consequence.

#### Scenario: Hard puzzle has dependency depth
- GIVEN a generated Hard Rule Grid round
- WHEN the canonical solver derives the unique solution
- THEN the proof contains a dependency chain deeper than one direct
  row/column lookup.

#### Scenario: Multiple independent blanks are insufficient
- GIVEN a puzzle where every blank can be solved independently from initially
  visible row/column information
- WHEN depth validation runs for Hard or Expert
- THEN the puzzle is rejected even if it has several blanks.

### Requirement: Rule Grid generation is unique and deterministic

Every returned Rule Grid puzzle MUST have exactly one solution under the
player-visible rules and MUST reproduce from recorded seed/difficulty/version.

#### Scenario: Many-seed uniqueness sweep
- GIVEN every production difficulty and a broad deterministic seed corpus
- WHEN rounds are generated and solved
- THEN every returned puzzle has exactly one solution and meets the difficulty's
  minimum deduction-depth contract.

### Requirement: Rule Grid difficulty scales reasoning, not only magnitude

Difficulty MUST vary inference depth and/or interacting constraints in addition
to ordinary size, round count, or time-budget changes.

#### Scenario: Expert is mechanically deeper than Easy
- GIVEN representative Easy and Expert generated corpora
- WHEN their solver traces are compared
- THEN Expert satisfies a strictly stronger minimum deduction-depth/constraint
  interaction contract.

### Requirement: Word Chain has durable content depth

The active Word Chain core pack MUST contain at least 90 unique validated chains
with at least 30 chains available for each active tier.

#### Scenario: Pack-count gate
- GIVEN the active Word Chain pack
- WHEN content validation runs
- THEN declared count equals actual count, total count is at least 90, and each
  tier has at least 30 chains.

### Requirement: Word Chain rejects low-diversity content

Word Chain validation MUST reject malformed links, duplicate chains, materially
near-duplicate/reordered chains beyond the documented threshold, duplicate IDs,
and inadequate decoy diversity.

#### Scenario: Reordered duplicate rejected
- GIVEN two chains that are equivalent under the validator's documented
  near-duplicate rule
- WHEN content validation runs
- THEN the pack fails with the conflicting IDs.

### Requirement: Context Fit has at least 60 items per tier

The active Context Fit pack MUST provide at least 60 validated items for each
active tier and at least 180 items total.

#### Scenario: Per-tier count gate
- GIVEN the active Context Fit pack
- WHEN content validation runs
- THEN every tier count is at least 60 and the declared aggregate count matches
  the actual items.

### Requirement: Context Fit preserves single-answer semantic integrity

Every Context Fit round MUST have one defensible accepted answer. Distractors
MUST be distinct, plausible enough to require context, and MUST NOT be
mechanically eliminated solely by obvious grammar/part-of-speech mismatch.

#### Scenario: Grammar-leaking distractor set rejected
- GIVEN an item whose answer is the only option compatible with the blank's
  basic grammatical role
- WHEN curated semantic/content validation runs
- THEN the item is rejected or corrected before shipping.

### Requirement: Transform Match final boundary enforces all invariants

Every returned Transform Match round MUST satisfy source validity,
non-degenerate chosen transform semantics, exact correct transform, distinct
options, required option count, and hidden-source unambiguity.

#### Scenario: Attempt budget cannot bypass invariant
- GIVEN candidate generation exhausts its normal attempt budget
- WHEN the generator reaches a fallback path
- THEN it regenerates/uses a proven supported deterministic fallback or fails
  explicitly; it MUST NOT return a candidate that skipped final validation.

#### Scenario: Requested option count is guaranteed
- GIVEN any production difficulty/profile and broad deterministic seed corpus
- WHEN rounds are generated
- THEN every round contains exactly the requested number of distinct options.

#### Scenario: Hidden-source semantic ambiguity rejected
- GIVEN two displayed options would both be defensible exact transform outcomes
  under the player-visible hidden-source instruction
- WHEN final round validation runs
- THEN that option set is rejected and regenerated.

### Requirement: Material challenge changes advance provenance

Any Rule Grid, Word Chain, Context Fit, or Transform Match change that alters
challenge generation/content semantics MUST advance the relevant
generator/content/scoring version required by existing provenance contracts.

#### Scenario: Sensitive change without version bump
- GIVEN generator/content-sensitive files change
- AND the required semantic version metadata does not advance
- WHEN provenance validation runs
- THEN validation fails.
