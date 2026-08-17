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

### Requirement: Ambiguous legacy items do not affect ratings
Until corrected content is active and validated, ambiguous Word Match rounds MUST NOT contribute authoritative Language rating movement.

### Requirement: Versioned corrected pack
The corrected pack MUST have a new distinguishable content version. Sessions created against the old ambiguous pack remain historical evidence and are not relabeled as if produced by the corrected pack.

### Requirement: Curated quality evidence
Tests MUST include concrete representative items across tiers and semantic categories, not only schema-shape tests. Emulator smoke MUST verify instructions and answer feedback align with the relation.