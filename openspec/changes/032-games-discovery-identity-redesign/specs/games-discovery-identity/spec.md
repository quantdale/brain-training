# Games discovery and identity requirements

## ADDED Requirements

### Requirement: Two-job Games hierarchy

The Games route MUST present one primary Suggested Next area in the default
state and a clearly labeled Browse All area for the complete catalog. Existing
recommendation evidence MAY provide the primary candidate and alternatives, but
the UI MUST NOT render the old recommendation sources as competing peer shelves.

#### Scenario: Default library presents one recommendation decision

- **WHEN** the player opens Games without a query or filter
- **THEN** one Suggested Next area appears before Browse All and includes a
  factual recommendation reason when evidence exists
- **AND** the complete catalog remains available below in Browse All

#### Scenario: Intentional browsing suppresses recommendation competition

- **WHEN** the player enters a search query or selects a category/favorites
  filter
- **THEN** Suggested Next is hidden or compressed and the filtered Browse All
  result becomes the clear content hierarchy

### Requirement: Honest discovery states

Search and category/favorites filters MUST operate over all registered games,
show the current count/state, support an obvious reset, and distinguish an
empty favorites collection from a query/filter with no matches.

#### Scenario: Empty favorites explain the recovery path

- **WHEN** the player selects Favorites and has no favorites
- **THEN** the screen says that there are no favorites yet and offers a path to
  Browse All

#### Scenario: No-match search explains and resets

- **WHEN** a query or combination of filters matches no registered game
- **THEN** the screen reports no matches, preserves the count context, and
  offers one action that clears the query and filters

### Requirement: Catalog-wide identity

Every generated catalog ID MUST resolve to deterministic identity metadata with
one of the eight primary mechanic families, a short verb, and a concise
interaction sentence. Identity presentation MUST use a restrained shared motif
and existing domain treatment; it MUST NOT alter game definitions, registry
generation, loading, scoring, mechanics, or persistence.

#### Scenario: Every catalog entry has an identity

- **WHEN** the generated registry is checked
- **THEN** all 42 stable IDs resolve to non-empty family, verb, and summary
  metadata and the eight primary families are represented

### Requirement: Play-first Game Detail

Game Detail MUST put identity/domain, title, mechanic understanding, tutorial
guidance when applicable, compact mastery/record context, and the dominant Play
action before deep records/history. Existing favorite, mastery, tutorial,
standalone-session, and offline behavior MUST remain intact.

#### Scenario: A registered game's detail leads to Play

- **WHEN** the player opens a registered game detail
- **THEN** identity, title, mechanic, mastery context, and Play appear before
  records and recent history
- **AND** existing favorite and standalone Play actions remain available

### Requirement: Runtime and accessibility evidence

Campaign completion MUST include repository and native validation, real rendered
light/dark evidence on one disposable normal Android AVD, representatives from
all eight primary families, accessibility/state coverage, and an honest human
validation classification.

#### Scenario: Runtime coverage is recorded honestly

- **WHEN** Campaign 032 is closed
- **THEN** its evidence package records real light/dark pixels, eight-family
  coverage, accessibility/state checks, and any unavailable human/provider
  evidence as pending or blocked rather than PASS
