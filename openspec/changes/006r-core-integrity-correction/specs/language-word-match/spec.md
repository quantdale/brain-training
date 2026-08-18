# Language Word Match — Delta Spec

## ADDED Requirements

### Requirement: Single defensible scored answer
Every Word Match round MUST present exactly one answer that satisfies the instruction's scored semantic relation. The system MUST NOT display several legitimate synonyms while arbitrarily designating one as correct.

#### Scenario: Synonym prompt
- GIVEN a prompt asking for a synonym
- WHEN four answer choices are shown
- THEN exactly one choice is an accepted synonym under the curated relation
- AND the remaining choices are plausible distractors but do not satisfy the same relation.

### Requirement: Content validator matches scoring semantics
The content validator MUST enforce structural uniqueness and the chosen semantic schema. At minimum it MUST reject duplicate IDs, duplicate/prompt options, invalid correct index/reference, malformed tiers, undeclared semantic references, and any machine-detectable multiple-correct condition.

#### Scenario: Validator rejects ambiguous content
- GIVEN a Word Match pack with duplicate IDs and multiple-correct options
- WHEN the content validator runs
- THEN it rejects the pack for duplicate IDs, invalid references, and machine-detectable multiple-correct conditions.

### Requirement: Ambiguous legacy items do not affect ratings
Until corrected content is active and validated, ambiguous Word Match rounds MUST NOT contribute authoritative Language rating movement.

#### Scenario: Legacy ambiguous rounds excluded from rating
- GIVEN ambiguous legacy Word Match rounds before corrected content is active
- WHEN Language rating is computed
- THEN those rounds do not contribute authoritative rating movement.

### Requirement: Versioned corrected pack
The corrected pack MUST have a new distinguishable content version. Sessions created against the old ambiguous pack remain historical evidence and are not relabeled as if produced by the corrected pack.

#### Scenario: Old sessions keep original version label
- GIVEN sessions created against the old ambiguous pack
- WHEN the corrected versioned pack ships
- THEN those sessions remain historical evidence under the old version and are not relabeled.

### Requirement: Curated quality evidence
Tests MUST include concrete representative items across tiers and semantic categories, not only schema-shape tests. Emulator smoke MUST verify instructions and answer feedback align with the relation.

#### Scenario: Smoke verifies instruction/answer alignment
- GIVEN representative Word Match items across tiers and categories
- WHEN emulator smoke runs
- THEN it verifies instructions and answer feedback align with the semantic relation, not only schema shape.