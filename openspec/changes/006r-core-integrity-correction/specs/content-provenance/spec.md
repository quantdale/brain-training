# Content and Generator Provenance — Delta Spec

## ADDED Requirements

### Requirement: Challenge identity is versioned
Every game MUST declare enough stable version metadata to identify the algorithm/content that produced a scored challenge. Procedural games require generator version; curated games require content-pack ID/version; hybrid games require both as applicable.

#### Scenario: Procedural and curated version metadata declared
- GIVEN a procedural game and a curated game
- WHEN each reports its scored challenge identity
- THEN the procedural game declares a generator version and the curated game declares a content-pack-independent version identifier.

### Requirement: Session provenance is persisted
Every completed scored session MUST persist the exact game/scoring/generator/content versions applicable to the challenge. Full semantic versions MUST remain distinguishable; storage MUST NOT collapse `1.0.0` and `1.1.0` into the same value.

#### Scenario: Historical replay explanation
- GIVEN a historical session
- WHEN a later app version changes a candidate pool or algorithm
- THEN the historical row still identifies the previous generator/content version
- AND tooling can determine which rules produced it.

### Requirement: Semantic challenge changes advance version
A change that can alter challenge selection, answer, difficulty mapping, scoring meaning, or seeded output for identical prior inputs MUST advance the relevant version. Cosmetic/comment/test-only changes do not require a bump.

#### Scenario: Behavior change bumps version
- GIVEN a change alters seeded output for identical prior inputs
- WHEN the game persists the new challenge
- THEN the relevant version is advanced while cosmetic-only changes do not require a bump.

### Requirement: Version-drift gate
CI MUST contain a deterministic check that detects configured provenance-sensitive files changing without an accompanying version update. The check MAY support explicit reviewed exceptions, but exceptions MUST be visible and documented.

#### Scenario: Provenance file changed without bump detected
- GIVEN a provenance-sensitive file changes with no version update
- WHEN the CI drift check runs
- THEN it fails unless a visible, documented reviewed exception applies.

### Requirement: Generated challenge final validation
All challenge sources MUST pass the game's final validity checks immediately before display/return. Curated and fallback paths MUST NOT bypass invariants simply because their data was authored manually.

#### Scenario: Curated path also validated
- GIVEN a curated challenge about to be displayed
- WHEN the final validity check runs
- THEN it passes the same invariants as procedural paths and does not bypass checks because it was manually authored.

### Requirement: Deterministic replay fixtures
Representative procedural, curated, and hybrid games MUST have pinned fixtures proving that the same version + seed/content item + difficulty inputs resolve consistently.

#### Scenario: Pinned fixture reproduces challenge
- GIVEN a pinned seed/content item, version, and difficulty for a representative game
- WHEN the generator resolves the challenge
- THEN it produces the same result as the recorded fixture.