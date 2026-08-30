# Release Certification — Delta Spec

## ADDED Requirements

### Requirement: Exact-state truth is durable

The repository MUST expose one unambiguous ACTIVE campaign while executable
work exists, or an explicit terminal `VALIDATED` state with no active campaign
and one recorded last campaign. It MUST NOT contain a terminal checkpoint whose
corresponding machine-readable lifecycle remains ACTIVE without an explicit
transition reason.

#### Scenario: Completed checkpoint conflicts with active lifecycle
- GIVEN a campaign has a terminal COMPLETED checkpoint
- AND its OpenSpec change or durable campaign fields still declare ACTIVE
- WHEN repository state is audited
- THEN the discrepancy is classified as a blocking lifecycle-truth defect and reconciled before successor activation.

#### Scenario: Validated repository has no authorized successor
- GIVEN the current campaign has passed all repository-owned and available
  automated exit gates
- AND remaining evidence is explicitly BLOCKED or NOT VALIDATED because the
  required device/manual environment is unavailable
- AND no successor campaign is authorized
- WHEN terminal state is recorded
- THEN `GOVERNANCE.activeCampaign` is `null`, the last campaign and
  `VALIDATED` status are recorded in the durable fields, and no new campaign is
  invented solely to hold external evidence.

### Requirement: Clean-checkout validation is reproducible

A fresh checkout MUST install and pass all required repository/app gates without inherited caches, untracked generated state, or legacy install flags.

#### Scenario: Fresh clone certification
- GIVEN a clean clone with no node_modules, generated native folders, Metro cache, or Jest cache
- WHEN the documented certification command sequence runs
- THEN install, validators, typecheck, lint, Jest, web export, and Expo Doctor complete without tracked-file drift.

### Requirement: Native build smoke is evidence-backed

The release-candidate SHA MUST demonstrate clean Android native generation/build and iOS simulator compile compatibility where infrastructure is available.

#### Scenario: Android clean native build
- GIVEN the final candidate SHA
- WHEN Expo native Android state is generated from committed configuration and a release/build-smoke is run
- THEN the build succeeds and generated permissions/config match the committed production boundary.

#### Scenario: iOS build infrastructure unavailable
- GIVEN no usable macOS/Xcode runner can be obtained
- WHEN final certification is recorded
- THEN iOS remains BLOCKED or NOT VALIDATED with evidence rather than inferred from TypeScript, web, or Android success.

### Requirement: Exact-SHA CI closes certification

Final certification MUST cite successful App CI and Repository Integrity runs for the exact final SHA.

#### Scenario: Local green but final CI missing
- GIVEN all local gates pass
- BUT the final pushed SHA has not completed both required GitHub workflows successfully
- WHEN release certification is evaluated
- THEN the campaign remains incomplete.

### Requirement: Deferred product scope remains deferred

Constitution-deferred systems MUST NOT be implemented merely to satisfy a generic notion of completion.

#### Scenario: Store work is out of scope
- GIVEN store signing, monetization, cloud auth/sync, AI production, or social systems remain constitution-deferred
- WHEN Campaign 016 executes
- THEN those systems are recorded as intentional non-blockers and are not added unless the owner separately opens that scope.
