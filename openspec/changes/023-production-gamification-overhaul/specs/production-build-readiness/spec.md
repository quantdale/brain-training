# Production Build Readiness — Delta Spec

## ADDED Requirements

### Requirement: Production build completes with zero errors

The production Android build pipeline MUST complete without compiler errors,
unresolved asset references, or strict-mode/type failures, at the campaign's
final SHA, and the release artifact metadata MUST be recorded.

#### Scenario: Clean release build

- GIVEN the fixed campaign head
- WHEN the production build runs
- THEN it completes successfully, the artifact exists with recorded size and
  hash, and the app starts without Metro.

### Requirement: Responsive safe-area layouts

All screens MUST respect safe areas and remain usable across standard phone
sizes (small ~4.7", large ~6.7") and both light/dark schemes; content MUST not
sit under notches, home indicators, or the tab bar, and primary actions MUST
stay reachable (including with the keyboard open).

#### Scenario: Small-screen and inset audit

- GIVEN a small-height device profile and forced large text
- WHEN each top-level screen and a representative game render
- THEN no primary action is clipped, overlapped, or unreachable and insets are
  applied.

### Requirement: Offline fallbacks hold

Core gameplay, workout, progression, rewards, and data export MUST function
with no network; any network-dependent decorative path MUST fail open or
degrade without blocking offline use.

#### Scenario: Airplane-mode journey

- GIVEN the device is offline from cold start
- WHEN the user plays a game, completes a workout, and exports data
- THEN all flows succeed locally with no network error surfacing.

### Requirement: Honest final classification

The campaign summary MUST report every verification as PASS, NOT VALIDATED, or
BLOCKED based on actual evidence, including external gates (store signing,
physical device, manual TalkBack, iOS runtime) that remain unperformed.

#### Scenario: No fabricated green

- GIVEN a check that could not be executed on this host
- WHEN the final report is written
- THEN it is classified NOT VALIDATED / EXTERNALLY BLOCKED with the reason.
