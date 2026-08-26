# Repository State Integrity — Delta Spec

## ADDED Requirements

### Requirement: Durable recovery documents agree on active campaign

Machine-readable identifiers/status extracted from governance, current campaign,
state, execution prompt, active OpenSpec metadata, and task ownership MUST agree.

#### Scenario: Contradictory stale campaign prose is rejected
- GIVEN STATE declares Campaign 014 active in one recovery field
- AND another authoritative recovery field says Campaign 013 is active
- WHEN repository state validation runs
- THEN validation fails with both conflicting references identified.

### Requirement: Recovery validation parses structured state

The repository MUST NOT rely solely on substring presence to prove campaign
consistency. Active campaign/status fields MUST be parseable deterministically.

#### Scenario: Active ID appears only in historical prose
- GIVEN the active campaign ID appears somewhere in STATE history
- BUT the structured current-state field names another campaign
- WHEN validation runs
- THEN validation fails rather than accepting the historical substring.

### Requirement: Repository-root hygiene rejects accidental residue

Repository validation MUST reject unexpected suspicious root artifacts while
allowing documented root files/directories and legitimate fixtures elsewhere.

#### Scenario: Empty shell residue at root
- GIVEN an unexpected zero-byte root file such as `'`
- WHEN repository hygiene validation runs
- THEN validation fails with an actionable removal/allowlist message.

### Requirement: Legacy OpenSpec lifecycle is evidence-consistent

Historical changes MUST NOT be archived or marked validated based on unrelated
newer CI evidence. Any reconciliation MUST identify the intended historical
final SHA or explicitly document why a superseding evidence policy is valid.

#### Scenario: Wrong SHA cannot close historical CI task
- GIVEN a legacy task requires CI on its final SHA
- AND only a later unrelated SHA is observed green
- WHEN legacy state is reconciled
- THEN the historical task is not silently marked complete without an explicit
  documented evidence rule.

### Requirement: Affected-area rules cover current first-class subsystems

Risk-based affected-area validation MUST recognize current first-class paths for
workout/personalization/mastery/spotlight, sync/data-portability,
content/registry/provenance, OpenSpec/campaign governance, and other actively
maintained top-level app subsystems.

#### Scenario: Modern subsystem change maps to checks
- GIVEN a changed path under `apps/mobile/src/workout/**`
- WHEN affected-area planning runs in strict mode
- THEN the path maps to concrete light validation instead of remaining
  unmatched.

### Requirement: Affected-area validation stays risk-based

Expanding affected-area coverage MUST NOT turn ordinary feature waves into
automatic full hardening. Expensive full-catalog/device/stress checks remain
reserved for explicit risk or campaign exit gates.

#### Scenario: Localized content edit remains localized
- GIVEN a curated content-pack-only change
- WHEN affected-area planning runs
- THEN it requires content/provenance/tests appropriate to that change and does
  not automatically require full 42-game certification.
