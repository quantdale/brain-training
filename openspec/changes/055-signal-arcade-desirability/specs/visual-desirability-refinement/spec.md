## Purpose

Deepen Signal Arcade into a desirable game product without replacing its
direction or opening a new total redesign: reduce dashboard grammar, strengthen
game fantasy, and make every RETHINK surface materially better while Campaign
054's technical floor stays intact.

## ADDED Requirements

### Requirement: Refinement contract before implementation

The campaign SHALL lock a written refinement contract before broad
implementation that defines protected Signal Arcade elements and the container,
typography, shape, colour, result, game-world, Profile, Rewards, Progress and
dark-mode roles that surfaces must consume.

#### Scenario: Implementation without a lock

- **WHEN** a surface is changed before the refinement lock exists
- **THEN** the change is out of scope and must be reverted or deferred

#### Scenario: Drift beyond the lock

- **WHEN** a proposed change does not map to a locked role or a Campaign 052
  finding
- **THEN** it is rejected as scope drift rather than absorbed into the campaign

### Requirement: Semantic container roles

Surfaces SHALL use Stage, Panel, Report, Slot, Key and Chip by semantic role
rather than defaulting every grouping to a card, and SHALL NOT nest cards inside
cards.

#### Scenario: Records and settings

- **WHEN** a surface groups records, stats, settings or history
- **THEN** it uses Report grammar with hairline rows, not a stack of bordered
  cards

### Requirement: Honest result emotional logic

Results SHALL present exactly one result artifact with a performance band
derived from the session's own performance, a factual completion statement
separate from performance, and reward amounts only as earned; a weak result
SHALL NOT use success colour, celebration, or success-implicating copy.

#### Scenario: Low-score session

- **WHEN** a session completes with a weak performance band
- **THEN** the result is neutral and honest, the reward is stated factually,
  and no confetti/success fill is shown

#### Scenario: Personal best

- **WHEN** a session sets a personal best
- **THEN** that is the single band headline and celebration may be used

### Requirement: Game identity before metadata

Games catalog tiles and rows SHALL present each game's world/identity before
its metadata, and SHALL NOT repeat an identical banner→badge→title→paragraph
construction for every game.

#### Scenario: Browsing 42 games

- **WHEN** the catalog renders the full library
- **THEN** every game is reachable in a dense, calm grid whose identity is
  visible before any metadata text is read, without hiding games behind
  carousels

### Requirement: Player identity profile

Profile SHALL present the player's identity and owned progression in its first
viewport, with record management, settings and data controls demoted below.

#### Scenario: First viewport

- **WHEN** Profile loads
- **THEN** the player identity (name, level, XP, streak, equipped cosmetics)
  owns the first viewport and no placeholder/internal label is shown

### Requirement: Collectible reward presentation

Rewards SHALL present cosmetics as collectible objects in a consistent grid
with distinguishable owned, equipped and locked states, and SHALL NOT rely on
emoji as finished collectible art.

#### Scenario: Mixed collection

- **WHEN** the collection contains owned, equipped and locked cosmetics
- **THEN** all three states are visible in the same grid with code-native
  object plates and their unlock conditions remain truthful

### Requirement: Protected technical floor

The campaign SHALL NOT regress the Campaign 054 technical floor or change
mechanics, scoring, timers, generators, difficulty, registry IDs, workout
semantics, XP, currency, reward economy, migrations, persistence semantics,
schema, routing contracts, testID contracts, accessibility semantics, opt-in
probes, the unexpected-console gate, bootstrap recovery or the route envelope.

#### Scenario: Visual change threatens a protected contract

- **WHEN** a visual refinement would change a protected contract
- **THEN** the change is narrowed or reverted and the contract check is run
  again

### Requirement: Evidence-backed completion

The campaign SHALL produce before/after native pixels from the baseline and
final release artifacts, three recorded critique passes, accessibility and
responsive evidence, performance sanity, the full repository matrix and final
native validation before any verdict.

#### Scenario: Verdict

- **WHEN** the campaign reports a verdict
- **THEN** the verdict is one of `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`,
  `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL` or `CAMPAIGN_055_BLOCKED` and every
  completion claim is derivable from recorded evidence
