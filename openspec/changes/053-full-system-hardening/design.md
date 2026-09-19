## Context

See [proposal.md](proposal.md) for motivation and scope. The mobile app is an
offline-first Expo/React Native application with SQLite as canonical state and
a registry-based catalog of 42 game modules. Current startup combines catalog
registration, progression initialization, profile/preference reads, and
ancillary setup in a broad post-initialization catch path. The existing suite
is broad and passing, but its output includes asynchronous-test and console
noise. The catalog already exposes injected persistence seams, while its
dynamic persistence failure coverage is intentionally representative rather
than all-game.

This change must preserve durable database formats and proven transaction/data
portability behavior. It is also constrained by Android-first emulator-local
QA, no host-input automation, and a dependency audit result where one
production-reachable advisory currently has a documented expiry rather than a
safe direct update.

## Goals / Non-Goals

**Goals:**

- Make foundational startup failure observable, recoverable, and independently
  testable without turning a cosmetic preference failure into an app outage.
- Make dependency risk decisions reproducible and stop a passing suite from
  normalizing uncontrolled warnings/errors.
- Replace representative catalog persistence failure evidence with a
  registry-derived executable contract.
- Preserve an accurate boundary between validated Android evidence and external
  evidence that is unavailable.

**Non-Goals:**

- Replacing the persistence architecture, Game SDK, routing framework, or
  visual language.
- Changing gameplay/scoring/progression economics or introducing a schema
  migration.
- Treating raw package-audit severity as a production exploit finding without
  reachability and compatibility analysis.
- Repairing remote zero-step CI infrastructure through speculative workflow
  changes.

## Decisions

### 1. Model bootstrap as classified stages, not one nonfatal catch

Future implementation will give each bootstrap stage a classified outcome:
foundational (catalog and canonical progression) or ancillary (preference and
optional setup). The application shell will consume an explicit bootstrap
state, including a retryable safe state for foundational failures. Retry will
only repeat safe/idempotent work, and a cold relaunch will remain a valid
recovery path.

This is preferred over retaining a single catch because the present path can
log a foundational error and expose a normal shell. It is preferred over
crashing the application because offline data/transient native initialization
can recover and the product needs an honest recovery path. It is also preferred
over making all preference reads fatal because that would convert a cosmetic
fault into loss of normal access.

### 2. Make dependency remediation a compatibility decision gate

The dependency advisory will first be evaluated against an officially
compatible Expo update path and its lockfile consequences. A change proceeds
only if that path removes the affected reachable advisory and passes the
affected build/test checks. If no compatible path exists, the existing
machine-readable disposition remains explicitly time-bounded with a documented
re-evaluation condition; no audit-suggested major downgrade is accepted merely
to make the audit output quieter.

An app-owned route envelope can reject unexpected format/length before a game
or session is selected. It is deliberately defense in depth: router parsing
may have occurred before app code sees those values, so it cannot be credited
as remediation for an upstream decoder advisory. This is preferred to a broad
router replacement, which would expand risk beyond the evidence.

### 3. Repair test signal at the source and scope expected errors locally

Known `act`, overlapping-action, and deprecated query patterns will be fixed
in the affected tests/components using supported synchronization. Tests that
deliberately exercise an error will assert it through a narrow local helper or
spy and restore the original behavior. Once the known baseline is clean, the
test harness can reject unexpected console noise with a small, reviewable
allowlist tied to test IDs rather than a global mute.

This is preferred to blanket console suppression or automatic retries because
both would conceal regressions. It is also preferred to making all console
output immediately fatal before the known debt is repaired, which would create
a noisy, non-actionable gate.

### 4. Derive persistence-failure coverage from the runtime registry

The contract harness will enumerate the registered games and require each one
to run a declared success, rejected-save, and stale-completion case using
existing injected persister/fixture surfaces where possible. A game that cannot
use the common adapter must enter a small explicit exemption map with an
alternate deterministic test. A registry addition without either path fails
the contract check.

This is preferred to migrating all 42 per-game persistence wrappers into a new
shared runtime abstraction: the observed gap is test breadth, not evidence
that the wrappers are incorrect. It preserves game-local mechanics, scoring,
generator versions, and result payloads while making drift visible.

### 5. Separate deterministic verification from environment evidence

Implementation validation will follow `.agent/IMPACT_MAP.md`, run relevant
validators and focused tests before the full suite, then perform a bounded
emulator-local Android launch/recovery journey on the single dedicated AVD.
The build identity used for runtime evidence will be recorded. Remote CI with
zero executed steps, iOS, physical/OEM Android, assistive technology, store
signing, and system-sheet interactions remain explicit external/manual
evidence gaps instead of being marked green.

## Risks / Trade-offs

- [Retry repeats a bootstrap side effect] -> Keep foundational stages
  idempotent, test retry and cold relaunch against durable counts/state, and
  retain atomic persistence boundaries.
- [Route bounds reject a legitimate existing link] -> Derive canonical values
  from the current catalog/session contract, test valid existing routes, and
  make malformed outcomes safe and navigable.
- [Dependency upgrade changes Expo/native behavior] -> Isolate the lockfile
  change, run Expo compatibility checks, native assembly, and affected runtime
  canaries before accepting it.
- [Console gate creates false positives] -> First remove known warnings and
  scope deliberately expected error paths; review any exception as test-owned
  and short-lived.
- [All-catalog matrix becomes slow or brittle] -> Use lightweight injected
  persistence seams, deterministic fixtures, and a serial canary/full split
  while preserving mandatory catalog discovery.
- [Runtime evidence is overclaimed] -> Record device/build identity and label
  unavailable platform/CI coverage as NOT VALIDATED.

## Migration Plan

1. Land bootstrap integrity changes and their fault-injection tests in one
   independently reversible slice; verify no data migration is emitted.
2. Evaluate the dependency decision in a separate lockfile-only or
   dependency-boundary slice. Revert it independently if compatibility or
   native validation fails, while retaining the accurate accepted-debt record.
3. Land test-signal repairs before enabling any stricter unexpected-console
   gate, so a failing signal has a known owner.
4. Add the registry-derived persistence contract and exemption evidence without
   modifying per-game scoring or durable result formats.
5. Converge with affected deterministic checks, full suite, Android assembly,
   and an emulator-local recovery canary. Record unavailable external evidence
   separately.

Rollback is commit-level and slice-local: revert the affected behavior or test
slice, rerun startup/persistence canaries, and retain the existing compatible
database format. A failed dependency update is reverted independently from
application behavior; no schema/data rollback is required.

## Open Questions

- Which officially supported Expo dependency version, if any, can eliminate
  the current production-reachable advisory without introducing a major
  compatibility break? The implementation task is deliberately gated on this
  investigation; either outcome preserves the selected contract.
