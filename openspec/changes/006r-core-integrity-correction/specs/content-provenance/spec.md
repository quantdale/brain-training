# Content and Generator Provenance — Delta Spec

## ADDED Requirements

### Requirement: Challenge identity is versioned
Every game MUST declare enough stable version metadata to identify the algorithm/content that produced a scored challenge. Procedural games require generator version; curated games require content-pack ID/version; hybrid games require both as applicable.

### Requirement: Session provenance is persisted
Every completed scored session MUST persist the exact game/scoring/generator/content versions applicable to the challenge. Full semantic versions MUST remain distinguishable; storage MUST NOT collapse `1.0.0` and `1.1.0` into the same value.

#### Scenario: Historical replay explanation
- GIVEN a historical session
- WHEN a later app version changes a candidate pool or algorithm
- THEN the historical row still identifies the previous generator/content version
- AND tooling can determine which rules produced it.

### Requirement: Semantic challenge changes advance version
A change that can alter challenge selection, answer, difficulty mapping, scoring meaning, or seeded output for identical prior inputs MUST advance the relevant version. Cosmetic/comment/test-only changes do not require a bump.

### Requirement: Version-drift gate
CI MUST contain a deterministic check that detects configured provenance-sensitive files changing without an accompanying version update. The check MAY support explicit reviewed exceptions, but exceptions MUST be visible and documented.

### Requirement: Generated challenge final validation
All challenge sources MUST pass the game's final validity checks immediately before display/return. Curated and fallback paths MUST NOT bypass invariants simply because their data was authored manually.

### Requirement: Deterministic replay fixtures
Representative procedural, curated, and hybrid games MUST have pinned fixtures proving that the same version + seed/content item + difficulty inputs resolve consistently.