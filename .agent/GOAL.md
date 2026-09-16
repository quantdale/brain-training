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

## Owner directive history — Campaign 027 (closed VALIDATED)

On 2026-09-13 the owner invoked **Campaign 027 — deep hardening**
(`027-deep-hardening`): a whole-repository engineering campaign with feature
development frozen, to be executed autonomously until its exit gate is
satisfied or a genuine blocker is durably recorded. The authorization is
explicit that hardening is user-invoked only, that the campaign must not stop
after the first success, and that verified improvement outranks speed.
Campaigns 017 through 026 are all closed (026 — visual identity rebuild —
VALIDATED). The agent must preserve honest `PASS` / `NOT VALIDATED` /
`BLOCKED` classifications.

## Successor campaign directive (2026-09-13; completed)

After 027 closed, the owner issued the **Autonomous Successor Campaign
Directive**: explicit authorization to autonomously determine, execute,
validate and continue through successor campaigns, quality-improvement passes
and production-hardening tasks until no material executable work remains. The
first successor, **Campaign 028 — production-readiness closure**
(`028-production-readiness`), built from four fresh read-only audits on
`1733458` (app surface, data portability, autobot harness, validators/CI),
closed VALIDATED. No new features; constitution-deferred systems stay
deferred.

## Owner migration directive — Campaign 029 (active)

On 2026-09-16 the owner directed the agent to replace the custom Android
Autobot/device-driving QA with Google ARTEMIS, keep the upstream checkout only
at `D:\Tools\artemis`, use ARTEMIS as the Codex Android runtime, install only
its supported MCP integration, remove obsolete repository driver code/docs/CI,
preserve semantic observability seams, and validate Flash/Pro/device/build
paths with honest blocker reporting. This is a bounded successor campaign,
not a new product feature or automatic full-hardening campaign. The active
OpenSpec binding is `029-artemis-runtime-qa-migration`.

## Historical terminal campaign state before Campaign 029

Campaign 028 was terminal for its authorized scope before the owner supplied
the ARTEMIS migration. Current execution follows Campaign 029's active
OpenSpec and durable state; do not reopen 028 or invent unrelated campaigns.
