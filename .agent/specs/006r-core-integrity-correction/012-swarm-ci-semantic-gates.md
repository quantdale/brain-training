# 012 — Swarm Ownership Validation, CI Semantic Gates, and No-Fake-Green Policy

**Priority:** P1 process / P2 infrastructure  
**Depends on:** implementation contracts from 002–011 sufficiently settled  
**Primary surfaces:** `.agent/tasks/**`, task/ownership manifest, `scripts/**`, `.github/workflows/**`, validation docs  
**Shared-file owner:** orchestrator

## Problems to correct

The existing autonomous system has good governance rules, but Campaign 006 packets violated them in machine-detectable ways:

- a packet declared one write surface and instructed creation outside it;
- multiple packets claimed overlapping tutorial files;
- a packet instructed direct edits to a generated registry artifact;
- a red typecheck checkpoint was pushed despite the campaign's green-wave rule.

Also, current CI is strong on build/tests but does not yet enforce several repository-specific semantic contracts uncovered by the audit.

## A. Machine-readable task ownership

Introduce a machine-readable ownership manifest for every concurrently executable packet. Recommended JSON/YAML shape:

```text
packet id
wave id
write surfaces (exact dirs/globs)
read-only surfaces if useful
orchestrator-owned surfaces requested
shared convergence requests
generated artifacts touched indirectly
dependencies
```

Requirements:

- every active packet has one manifest entry;
- overlapping write surfaces in the same concurrent wave are rejected unless explicitly marked orchestrator-serialized;
- packet Markdown may remain the human-readable instruction, but manifest is the machine authority for ownership;
- a packet cannot claim generated output as directly editable when generator ownership says otherwise;
- shared navigation/schema/registry/package/CI surfaces default to orchestrator ownership.

For Campaign 006R, create explicit packet/wave ownership before launching subagents.

## B. Ownership validator

Add a local script that fails on at least:

- overlapping write surfaces among packets in same wave;
- active packet missing ownership entry;
- declared write outside allowed repository root;
- generated-file direct ownership when file is registered as generated;
- orchestrator-owned path assigned to coder packet without explicit exception;
- dependency cycle in packet graph if dependencies are machine represented.

Where glob intersection is hard, prefer conservative rejection and explicit serialization over unsafe concurrency.

The validator must run before swarm launch and in CI/repository integrity.

## C. Semantic CI gates

App CI / repository integrity should run appropriate cheap deterministic checks on every push/PR. At minimum integrate:

1. repository-state validator;
2. task ownership validator;
3. TypeScript typecheck;
4. full/CI Jest suite;
5. registry generator `--check`;
6. provenance/version validator from Spec 003;
7. offline-boundary/static validator already present in repo;
8. web export build smoke;
9. Expo Doctor;
10. lint if it can be made deterministic/green without hiding legitimate existing debt.

If lint has real historical debt too broad for this corrective campaign, document exact count/scope and run a changed-files lint gate rather than omitting lint silently. Prefer fixing the baseline if feasible.

Do not put expensive emulator QA in GitHub Actions unless infrastructure explicitly supports it; local one-AVD QA remains primary for runtime convergence.

## D. Cross-subsystem contract suite

Add a small high-value suite designed to catch defects that thousands of isolated tests missed. This suite should use production-shaped wiring and include:

- lowercase difficulty -> real rating service -> DB session/history;
- adaptive final challenge different from start baseline;
- authoritative completion XP -> displayed result;
- generator final validation across each difficulty for Equation Builder;
- Word Match unique-answer content invariant;
- persisted tutorial completion after remount/hydration;
- persisted workout resume + transactional reroll;
- atomic quest/achievement/streak purchase failure injection;
- unsupported future DB version rejection;
- Home/Profile streak equivalence on high-density session history.

Give this suite a stable command such as `npm run test:contracts` or repository-level equivalent. CI should run it explicitly even if full Jest also contains the files, so its role is visible.

## E. Dependency/security triage

The audit observed npm audit findings including high-severity transitive packages. Do not run blind `npm audit fix --force`.

Create a checked-in/current triage note or script output classifying:

- production runtime dependency vs dev/test tooling;
- reachable in the mobile bundle vs Node-only toolchain;
- fixed version available compatible with Expo SDK or not;
- action: upgrade now / wait for upstream / false-positive-not-reachable / investigate.

Only unresolved **meaningfully exploitable production** High/Critical findings block 006R. Dev-tool findings remain recorded debt with rationale.

## F. Pre-push/convergence rule

Document and automate as much as practical:

Before a coherent main push, the orchestrator must run the risk-based local gate required by changed surfaces. At minimum for shared/platform changes:

```text
repo validator
ownership validator
registry/provenance checks
contract suite
TypeScript
relevant targeted tests
full CI Jest before campaign milestone
```

A push may intentionally be `BLOCKED checkpoint` only when main still builds/starts and durable state precisely identifies the blocker. A known typecheck failure is not a routine acceptable checkpoint.

## G. No fake green

Validation status vocabulary:

- `PASS` — command/test actually executed successfully on applicable environment.
- `FAIL` — executed and failed.
- `BLOCKED` — required external prerequisite prevents progress and stops dependent work.
- `NOT VALIDATED` — not executable in current environment, not evidence of pass.
- `QUARANTINED` — only for understood non-blocking flaky test with root-cause note + closure criteria.

The validator/docs should reject or flag wording that records unavailable iOS/emulator/tooling as PASS where practical.

## Required tests

- synthetic overlapping packet manifests are rejected;
- disjoint same-wave packets accepted;
- generated-file ownership violation rejected;
- orchestrator exception/serialization accepted when explicit;
- provenance/registry/offline checks fail on deliberate fixtures in script tests where feasible;
- contract-suite command passes on repaired system;
- GitHub Actions config invokes the intended commands in correct working directories.

## MUST acceptance criteria

- Active packet ownership is machine-readable.
- Concurrent write overlap is rejected before swarm work begins.
- Generated/shared surfaces are protected by ownership rules.
- CI runs repository-specific semantic gates, not only generic Jest/typecheck.
- Cross-subsystem contract suite exists and would have caught the main audit P1 defects.
- Dependency vulnerabilities are triaged rather than blindly auto-fixed/ignored.
- No-fake-green status language is documented and used in `.agent/VALIDATION.md`.
- GitHub Actions green on final convergence commit.

## Forbidden shortcuts

- Encoding ownership only in prose and calling it validated.
- Allowing overlapping globs because agents are “unlikely” to edit the same file.
- Editing generated registry directly in coder packets.
- Marking a flaky test fixed by adding sleep/retry without cause.
- Removing contract tests from CI because full Jest is “already large enough.”
- Treating all npm audit severities as equal without reachability/context.