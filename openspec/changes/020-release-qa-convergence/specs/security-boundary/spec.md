# Security Boundary — Delta Spec

## ADDED Requirements

### Requirement: High-confidence tracked secrets fail CI

Repository Integrity MUST scan Git-tracked text files for high-confidence
private-key and provider-token formats and fail without printing secret values.

#### Scenario: Provider token is committed

- GIVEN a tracked text file contains a recognized provider token format
- WHEN the repository gate runs
- THEN it fails with only file, line, and pattern metadata.

### Requirement: Clean repository remains clean

The scanner MUST report a clean result when no high-confidence secret pattern
is present.

#### Scenario: Ordinary security words are present

- GIVEN tracked source and documentation contain ordinary words such as
  "token" or "secret"
- WHEN the scanner runs
- THEN it reports no false positive for those ordinary words.
