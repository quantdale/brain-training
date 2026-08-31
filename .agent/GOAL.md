# Ultimate Goal and Goal-Mode Entry

## Ultimate product goal

Build the original, closed-source, offline-first Android+iOS brain-training product defined by `docs/PROJECT_CONSTITUTION.md`, with a large modular catalog, adaptive scoring/progression, strong local ownership, and optional future cloud/AI/monetization layers.

The repository must remain continuously recoverable and autonomously developable by fresh Kimi/Codex/other capable agent sessions.

## Normal Kimi goal command — Day mode

```text
/goal Continue development using day mode. Complete the active campaign in .agent/CURRENT_CAMPAIGN.md according to AGENTS.md and the committed project constitution. Continue autonomously across turns until the campaign exit criteria are satisfied or a genuine blocker has been durably recorded and pushed. Use safe parallel swarm work where ownership can be partitioned. Do not launch a full hardening campaign.
```

## Normal Kimi goal command — Night mode

```text
/goal Continue development using night mode. Complete the active campaign in .agent/CURRENT_CAMPAIGN.md according to AGENTS.md and the committed project constitution. Continue autonomously across turns until the campaign exit criteria are satisfied or a genuine blocker has been durably recorded and pushed. Use safe parallel swarm work where ownership can be partitioned. Do not launch a full hardening campaign.
```

## Hardening

Full hardening is user-invoked only. When requested, first clarify scope from the user's explicit command if it is not already specified: affected subsystem, current milestone, entire app, or production hardening.

## Current owner directive

On 2026-08-30 the owner explicitly authorized a whole-codebase hardening
pass, followed by autonomous execution of Campaigns 017 through 020, with a
second whole-codebase hardening pass after Campaign 020. The agent may choose
the concrete campaign packets within the constitution and must preserve
honest `PASS` / `NOT VALIDATED` / `BLOCKED` classifications.

## Terminal campaign state

When `GOVERNANCE.activeCampaign` is `null` and the durable state records a
validated last campaign, the repository is terminal for the currently
authorized scope. Do not create a successor campaign merely to hold external
device/manual certification or deferred product decisions. A new campaign
requires explicit owner authorization and genuinely new scope.
