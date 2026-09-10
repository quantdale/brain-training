# Refero Design Research — Delta Spec

## ADDED Requirements

### Requirement: Refero MCP is configured without committing its credential

The Refero design-reference MCP server MUST be configured for the agent
environments used in this repository, and its bearer token MUST NOT be
committed to the repository in any form.

#### Scenario: Credential stays out of Git

- GIVEN the owner-provided Refero bearer token
- WHEN MCP configuration is added
- THEN the token lives only in gitignored local configuration
  (`.kimi-code/local.toml`) or user-scoped configuration outside the
  repository, and `git status`/tracked files contain no token material.

### Requirement: Refero connection is verified before design work

Before any UI/UX work begins, the Refero MCP endpoint MUST be proven reachable
with the configured credential, and the available research tools MUST be
enumerated.

#### Scenario: Live handshake and tool listing

- GIVEN the configured credential
- WHEN an MCP `initialize` and `tools/list` request is issued
- THEN the server responds with its identity and a non-empty tool list
  (`refero_search_screens`, `refero_search_styles`, `refero_get_style`,
  `refero_search_flows`, image/similar tools).

### Requirement: Benchmark research precedes implementation

Design research MUST query Refero for the benchmark apps named by the owner
(Duolingo, Brilliant, Headspace) covering reward loops, streak counters, daily
progress indicators, level-completion celebrations, sound/haptic triggers, and
success/fail feedback pacing, and the findings MUST be recorded in the campaign
packet before implementation.

#### Scenario: Reference lock recorded

- GIVEN fetched reference screens/styles for the benchmark apps
- WHEN implementation begins
- THEN the campaign packet contains a reference lock: primary direction,
  traits to preserve, borrowed details, explicit rejects, and concrete token
  commitments.

#### Scenario: Research tool unavailable

- GIVEN the MCP endpoint is unreachable or returns no useful results
- WHEN design work would depend on it
- THEN the limitation is recorded honestly and implementation proceeds from
  the constitution's locked visual intent plus documented benchmark knowledge,
  not fabricated research evidence.
