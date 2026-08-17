# 003 — Content/Generator Integrity and Provenance Versioning

**Priority:** P1 / blocking for content-dependent games  
**Depends on:** 001  
**Precedes:** 004, 005  
**Primary surfaces:** game content packs, generators, `game.json`, session provenance, registry generator/checks, CI validation scripts

## Problems to correct

The repository correctly intends historical sessions to be reproducible from version + seed + difficulty, but Campaign 006 changed content/generator candidate pools without consistently advancing the corresponding version. A seed can therefore produce different content while claiming the same generator/content version.

The current Word Match pack expanded while retaining `packVersion: 1.0.0`. Math generators gained curated templates without a machine-enforced generator version bump. Some curated banks do not have an explicit independent pack version at all.

## Core content contract

Every challenge source that affects what the player can see must be classified as one of:

1. **Procedural generator** — versioned by `generatorVersion`.
2. **Curated/versioned content pack** — stable `packId` + `packVersion`.
3. **Hybrid** — both generator version and content-pack identity/version are persisted.

For every completed session, provenance must be sufficient to answer:

- which game version ran?
- which scoring version normalized it?
- which generator algorithm/version chose/generated the challenge?
- which curated pack/version supplied authored content, if any?
- which RNG algorithm/version and canonical seed were used?
- which effective difficulty/challenge parameters applied?

## Required work

### A. Inventory all 20 games

Create a checked-in machine-readable provenance inventory (location chosen by orchestrator) with one entry per registered game:

- game id;
- content model: procedural / curated / hybrid;
- version source(s);
- content-sensitive source paths/globs;
- generator-sensitive source paths/globs;
- session fields that persist provenance;
- replay support status.

The inventory must be generated or validated against the game registry so a newly registered game cannot silently omit it.

### B. Correct current version drift

Audit changes since the last known valid version boundary. At minimum inspect:

- `language-word-match` pack expansion;
- `language-sentence-builder` curated sentence bank expansion;
- `language-word-scramble` word-bank changes;
- `math-equation-builder` curated template additions;
- `math-missing-operator` curated equation additions;
- `math-fast-math` curated problem additions.

Where the challenge pool/selection behavior changed without a version bump, advance the correct semantic version **once**, using the repo's documented policy. Do not manufacture historical versions that never existed; document the correction boundary.

For curated banks that currently have no pack version, add a stable pack identity/version or explicitly classify the bank as part of the generator version and persist that fact. Prefer explicit pack versions for authored content that may update independently.

### C. Persist full semantic versions

The raw diagnostic/result envelope must retain full string versions. Do not rely only on an integer major projection to interpret history.

Spec 009 owns the structured DB migration decision, but this spec must ensure every game/raw result already carries complete version strings and content-pack identity/version where applicable.

### D. Add a machine-enforced version-change guard

Implement a repository validator that makes silent provenance drift difficult. The exact mechanism may be a generated manifest/digest, but it must satisfy:

- content-sensitive files are associated with a declared pack/generator version;
- generator-sensitive files are associated with a generator version;
- a change to a tracked content/generator surface without updating its provenance manifest/version causes `--check`/CI failure;
- a version bump + regenerated manifest restores green;
- ordinary screen styling or unrelated test changes do not force generator/content bumps.

Recommended design: a checked-in generated provenance manifest that hashes only declared challenge-affecting files and records the declared version(s). A script recomputes the hashes and fails if content changed while the version identity remains unchanged.

Do not build the validator around network access or mutable remote state.

### E. Final-output validation hook

All generator/content loaders must validate the **actual output returned to gameplay**, not merely the random candidate loop. This includes curated-template fast paths and deterministic fallbacks.

Each game should expose or internally call a pure invariant validator suitable for tests. Examples:

- arithmetic puzzle solvable under active operators and rules;
- missing-operator answer unique;
- sequence within tile/range constraints;
- language item has exactly one correct answer under its declared contract;
- distractors distinct and valid;
- no invalid/empty content pack is loaded.

### F. Replay fixture contract

For representative games from procedural, curated, and hybrid models, add replay fixtures asserting that a persisted provenance tuple regenerates/reselects the same challenge sequence. At least one fixture must survive a simulated unrelated game-code change where the provenance version does not change.

## Versioning policy

Use semantic versioning for challenge provenance:

- PATCH: bug fix that preserves the generated challenge set/meaning for existing provenance, or validator-only change that does not alter selection/output.
- MINOR: backwards-compatible content additions or generator behavior changes that can change challenges for a given seed; because replay identity changes, the new version must be persisted.
- MAJOR: incompatible challenge schema/rules requiring a new interpretation/migration.

If an existing game has a different established policy, document it in the provenance inventory and ADR; do not silently diverge.

## Required tests

- provenance inventory contains every registered game exactly once;
- validator detects a simulated tracked-content mutation without version change;
- validator accepts the same mutation when the corresponding version/manifest is advanced;
- at least one procedural, one curated, and one hybrid replay fixture is exact;
- every content pack validates item count/schema/identity/version;
- every generator's public return path passes its final invariant validator over representative seed sweeps.

## MUST acceptance criteria

- Current content/generator version drift is corrected and documented.
- Full version strings and pack identity/version are present in persisted raw/diagnostic provenance where applicable.
- A machine-enforced provenance/version validator exists and is runnable locally without network.
- New registered games cannot silently omit provenance classification.
- Final-output invariants cover fast paths and fallbacks, not only main random paths.
- Targeted tests, full suite, typecheck, registry check, and provenance validator pass.

## Forbidden shortcuts

- Bumping every game's version indiscriminately to silence the validator.
- Using file modification timestamps as provenance.
- Persisting only the numeric major version when the real version is semantic.
- Treating curated content as "safe" without validating the selected item.
- Changing content and then updating a hash manifest without also advancing the identity/version that historical replay uses.