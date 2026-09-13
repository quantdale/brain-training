## ADDED Requirements

### Requirement: Claimable surfaces sync before they count
Home's claimable-reward hint and the Rewards inbox MUST run quest/achievement sync (or `initializeProgression`) against current history before reading claimable rows, so a session completed in this process can unlock a daily quest without visiting Profile.

#### Scenario: Daily quest appears on Rewards after play
- GIVEN a daily quest whose goal is met by the latest persisted session and Profile has not been focused
- WHEN Rewards (or Home's claimable count) loads
- THEN the quest is present as claimable

#### Scenario: Profile path remains correct
- GIVEN the same session
- WHEN Profile focuses
- THEN it still syncs once and does not double-grant

### Requirement: Wipe rehydrates a usable empty product in-process
After a successful production wipe, the same process MUST have a singleton profile and current quest/achievement definitions so Home/Profile/play do not depend on process restart. Session/XP/ledger counts remain empty.

#### Scenario: Wipe then Profile without restart
- GIVEN Data Management wipe succeeded
- WHEN Profile loads in the same JS process
- THEN a profile row exists, quest definitions are present, and progress is empty rather than a foreign-key/load failure

#### Scenario: Wipe does not restore sessions
- GIVEN wipe succeeded
- WHEN session/ledger counts are read
- THEN they are zero
