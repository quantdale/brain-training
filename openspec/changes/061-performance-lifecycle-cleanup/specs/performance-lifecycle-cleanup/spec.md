# Spec — performance-lifecycle-cleanup

## ADDED Requirements

### Requirement: Progress focus reloads are throttled

Focus SHALL bump `nowMs` always (labels stay fresh) but SHALL schedule a
snapshot reload only when more than 5000ms elapsed since the last
scheduled reload. Explicit retry SHALL always reload.

#### Scenario: Bounce skips reload

- GIVEN a completed load 2s ago
- WHEN the screen refocuses
- THEN no new snapshot load is scheduled (`nowMs` still updates).

#### Scenario: Settled focus reloads

- GIVEN the last scheduled reload is 30s ago
- WHEN the screen refocuses
- THEN a new snapshot load is scheduled.

### Requirement: Discovery preserves mastery identity

Reloads SHALL reuse the previous load's per-game mastery summary object
when its content is identical (JSON-equal), and SHALL reuse the favorites
`Set` when membership is identical, so memoized tiles bail out. Changed
games SHALL yield fresh objects.

#### Scenario: Identical reload reuses objects

- GIVEN two consecutive loads with identical mastery inputs
- WHEN the snapshot rebuilds
- THEN every per-game summary is `===` the previous load's object.

#### Scenario: Changed game yields a new object

- GIVEN a mastery input change for one game
- WHEN the snapshot rebuilds
- THEN that game's summary is a new object; all others are reused.

### Requirement: Countdown settles at zero (single shared copy)

The tick interval SHALL stop once the remaining time reaches 0 (in
addition to unmount cleanup). Post-deadline renders SHALL NOT occur.
The bar SHALL exist exactly once, as the shared `game-ui` primitive
consumed by both reflex games — per-game twins are prohibited (a twin
is how this repair was missed once already).

#### Scenario: No ticks past the deadline

- GIVEN a mounted countdown past its deadline
- WHEN time passes
- THEN no further state updates fire.

### Requirement: Fire-and-forget animations stop on unmount

The game-host results entrance, workout completion entrance, and reward
celebration SHALL stop their in-flight animation on unmount. Curves,
durations, and reduced-motion paths SHALL NOT change.

#### Scenario: Unmount stops the driver

- GIVEN a mounted entrance animation mid-flight
- WHEN the component unmounts
- THEN the animation is stopped (no writes to unmounted values).

### Requirement: Ring ticks memoize on the filled count

`ProgressRing` SHALL rebuild its tick elements only when the filled
count (or geometry/theme/testID inputs) changes — not on every
per-frame numeric-mirror update. Rendered pixels SHALL be identical.

#### Scenario: Same fill reuses elements

- GIVEN a mounted ring at fill N
- WHEN the animated mirror updates without changing N
- THEN the tick element identities are preserved.

### Requirement: Press drivers stop on supersede and unmount

Starting a new press animation SHALL stop the in-flight one; unmount
SHALL stop any in-flight driver and reset the value.

#### Scenario: Rapid press-in/out does not accumulate drivers

- GIVEN a press-in animation in flight
- WHEN press-out starts (or unmount happens)
- THEN the earlier driver is stopped.

### Requirement: Stale async snapshots never win (defense in depth)

`useDbData` SHALL ignore resolutions superseded by a newer load from
dependency bumps (keeping the unmount guard). Out-of-order completion
SHALL leave the freshest scheduled load's data on screen. (The sequence
token is redundant with React's cleanup ordering by construction — kept
as one-ref armor, not as a behavior change.)

#### Scenario: Slow-then-fast resolves fresh

- GIVEN load A (slow) superseded by load B (fast)
- WHEN A resolves after B
- THEN the screen keeps B's data.

### Requirement: A11y focus retries are cancellable

`requestAccessibilityFocus` SHALL return a cancel function clearing
pending retry timeouts; `useInitialA11yFocus` SHALL cancel on effect
cleanup (deactivation/unmount).

#### Scenario: Unmount drops pending fires

- GIVEN a pending focus retry
- WHEN the owner unmounts or deactivates
- THEN no further focus attempts fire.

### Requirement: Toast queue is bounded

`showToast` beyond `MAX_QUEUED_TOASTS` (8) SHALL drop the oldest queued
toast. Mount/flush/toast-timing behavior SHALL NOT change.

#### Scenario: Overflow drops oldest

- GIVEN 8 queued toasts with no host
- WHEN a 9th is shown
- THEN the queue holds the newest 8.

## MODIFIED Requirements

None. All changes are additive guards, cleanup, and identity preservation.

## REMOVED Requirements

None.
