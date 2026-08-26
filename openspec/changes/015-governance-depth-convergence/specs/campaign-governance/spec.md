# Campaign Governance — Delta Spec

## ADDED Requirements

### Requirement: Active campaign has exactly one executable OpenSpec change

When governance names a non-null active campaign, repository validation MUST
require exactly one matching OpenSpec change directory whose metadata ID equals
that campaign and whose lifecycle status is ACTIVE.

#### Scenario: Missing active change is rejected
- GIVEN governance names `015-governance-depth-convergence`
- AND the matching OpenSpec directory is missing
- WHEN repository state validation runs
- THEN validation fails before autonomous implementation begins.

#### Scenario: Proposed change cannot masquerade as active
- GIVEN governance names a campaign
- AND the matching change metadata is still PROPOSED
- WHEN repository state validation runs
- THEN validation fails and reports the lifecycle mismatch.

### Requirement: Active change execution surface is complete

The active OpenSpec change MUST contain non-empty proposal, design, tasks,
execution entrypoint, audit map, change metadata, and every normative spec
declared by metadata.

#### Scenario: Missing normative spec is rejected
- GIVEN an ACTIVE change declares a spec in `specOrder`
- AND that spec file is absent or empty
- WHEN repository state validation runs
- THEN validation fails with the missing spec path.

### Requirement: Campaign transitions preserve one-active invariant

A successor campaign MUST NOT become ACTIVE until its predecessor is durably
COMPLETED according to the predecessor's exit contract. Transition updates MUST
leave exactly one active campaign pointer across durable state.

#### Scenario: Successor activation blocked by active predecessor
- GIVEN Campaign 014 remains ACTIVE
- WHEN an agent attempts to activate Campaign 015
- THEN validation rejects the transition and Campaign 015 remains PROPOSED.

#### Scenario: Valid predecessor-to-successor transition
- GIVEN Campaign 014 is durably COMPLETED with required evidence
- WHEN the orchestrator activates Campaign 015
- THEN governance, state, current campaign, execution prompt, OpenSpec metadata,
  and ownership metadata all identify Campaign 015 as the sole active campaign.

### Requirement: Task ownership is bound to the active change

The machine-readable task-ownership definition MUST identify the same change as
governance and the active OpenSpec package.

#### Scenario: Historical ownership map is rejected
- GIVEN Campaign 015 is active
- AND `.agent/task-ownership.json.change` names 006R or any other change
- WHEN ownership/repository validation runs
- THEN validation fails before parallel coders launch.

### Requirement: Ownership surface intersection is safe

Parallel ownership validation MUST reject coder write surfaces that overlap
another concurrently writable packet, intersect orchestrator-only surfaces, or
intersect generated outputs, including when a coder declares a broad glob.

#### Scenario: Broad glob contains generated file
- GIVEN a coder claims `apps/mobile/src/**`
- AND a generated registry under that tree is orchestrator-only
- WHEN ownership validation runs
- THEN the claim is rejected even though the literal glob strings differ.

#### Scenario: Dependency graph cycle is rejected
- GIVEN packet A depends on B and B depends on A
- WHEN ownership validation runs
- THEN validation fails before the swarm wave starts.

### Requirement: Task packets declare completion validation

Every active parallel packet MUST declare cheap completion validation appropriate
to its write surface.

#### Scenario: Packet omits validation
- GIVEN a coder packet has write ownership but no completion validation
- WHEN ownership validation runs
- THEN the packet is rejected as incomplete.

### Requirement: Campaign control-plane tests cover failure cases

Repository tests MUST pin the missing-change, stale-change, status-mismatch,
broad-glob protected intersection, generated intersection, duplicate packet ID,
missing dependency, cyclic dependency, and missing-validation cases.

#### Scenario: Known false-green regressions are mutation-visible
- GIVEN the governance validator test suite
- WHEN one of the required control-plane guards is removed or weakened
- THEN at least one focused regression test fails.
