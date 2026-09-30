# Navigation Stack Integrity

## Purpose

Define the observable contract for cross-destination navigation, for exiting a
pushed route, and for the destination that a back affordance actually reaches, so
that history does not accumulate and every reachable screen has a correct way
out.

## ADDED Requirements

### Requirement: Cross-destination navigation does not grow the history stack

Navigation to a top-level destination — a tab or a root destination — SHALL
replace the current stack position rather than push a new entry, so that
repeated visits do not accumulate history and back from a top-level destination
does not re-enter a flow the user has already completed.

Navigation to a detail or nested destination SHALL continue to push, so that back
returns to the list the user came from.

#### Scenario: Repeated visits to a tab

- **GIVEN** a user visits a tab, then a detail screen, then the tab again
- **WHEN** the user presses the system back gesture from the tab
- **THEN** the user leaves the tab rather than re-entering the detail screen
- **AND** the number of history entries does not grow with each visit

#### Scenario: Back from a detail screen

- **GIVEN** a user navigated from a list to a detail screen
- **WHEN** the user presses back
- **THEN** the user returns to the list

#### Scenario: Reaching a top-level destination from a nested flow

- **GIVEN** a user is in a nested flow
- **WHEN** they choose to go to a top-level destination
- **THEN** they arrive at that destination
- **AND** back from it does not return to the abandoned nested flow

### Requirement: Every reachable screen has a correct, discoverable exit

Every screen the user can reach SHALL provide a way to leave, whether through a
visible control or through a system-provided affordance. A screen with no
visible header controls SHALL still be reachable by back in a way that lands the
user on a sensible destination.

#### Scenario: Screen with hidden headers

- **GIVEN** a screen rendered with all header chrome hidden
- **WHEN** the user is on that screen
- **THEN** a back affordance is reachable
- **AND** using it lands the user on the screen's owning destination

#### Scenario: Deep link into a pushed screen

- **GIVEN** a user opens a deep link that lands directly on a pushed screen with
  no navigation history
- **WHEN** the user requests back
- **THEN** the user lands on the screen's owning destination
- **AND** the app does not leave the user on the screen with no way forward

### Requirement: The back affordance's announced destination is where back goes

Where a screen presents a control or label that names a destination, the
navigation that control performs SHALL reach that destination on every entry
path into the screen. Back from the screen SHALL NOT reach a different
destination than the one named, unless the screen states the difference.

#### Scenario: One destination, several entry paths

- **GIVEN** a screen reachable by more than one entry path
- **WHEN** the user arrives via each path and activates the back affordance
- **THEN** each path lands on the destination the affordance names
- **AND** where a path cannot honor that, the screen presents an affordance that
  names the destination that path actually reaches

### Requirement: Regression guards cover every route source

The automated guard that prevents a known-unsafe navigation pattern from being
reintroduced SHALL scan every source location that can perform navigation, not
only one subtree. Adding a route module in a directory outside the scanned set
SHALL be sufficient to bring it under the guard.

#### Scenario: New route module in an unscanned directory

- **GIVEN** a new route module is added outside the directories the guard
  currently scans
- **WHEN** the guard runs
- **THEN** the new module is scanned
- **AND** the unsafe pattern in it is detected

#### Scenario: Unsafe pattern reintroduced

- **GIVEN** a route module that performs the unsafe navigation pattern
- **WHEN** the guard runs
- **THEN** the guard fails and names the file and the pattern
