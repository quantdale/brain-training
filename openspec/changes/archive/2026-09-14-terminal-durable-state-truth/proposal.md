# Proposal — Terminal durable-state truth

## Why

Machine-readable campaign state is terminal (`GOVERNANCE.activeCampaign: null`, last campaign `028-production-readiness` VALIDATED). Recovery prose on the `AGENTS.md` startup path still tells a fresh agent that 028 (or even 027) is active and to execute `EXECUTION_PROMPT.md` until the exit gate. `validate-repo-state.mjs` ignores that prose, so CI stays green while `/goal Continue development` would try to re-implement a closed campaign. 028 D2 required one coherent current status; W7 closed structured fields only.

This change is documentation-only. It MUST NOT bind `GOVERNANCE.activeCampaign` or start an implementation campaign. OpenSpec 1.6.0 in this repo does not honor `skip_specs`, so a narrow recovery-prose spec is included.

## What Changes

- Align **current-status prose** with structured terminal fields in:
  - `.agent/STATE.md` (Current status, Continuation rule, leftover "Next: W6")
  - `.agent/CURRENT_CAMPAIGN.md` (`Change: … (ACTIVE)` line)
  - `.agent/KNOWN_ISSUES.md` header
  - `.agent/BACKLOG.md` (still names 027 as active)
  - `.agent/GOAL.md` current vs historical directives
  - `docs/PROJECT_CONSTITUTION.md` Implementation status line
  - `docs/MASTER_PLAN.md` current-campaign blurb
- Continuation rule MUST say: no active campaign; do not execute 028; next work requires a new owner-authorized change.
- Historical `EXECUTION.md` ACTIVE headers in 015–027 are **out of scope** (closed packets).

## Capabilities

### New Capabilities

- `durable-recovery-prose`: current-status recovery documents match terminal GOVERNANCE (no active 027/028).

### Modified Capabilities

- (none)

## Impact

- Durable markdown listed above
- `scripts/validate-repo-state.mjs` structured parsers MUST remain green (do not weaken them)

## Out of scope

- Product/application source
- Activating a successor campaign
- Rewriting VALIDATION.md historical evidence blocks
- Archiving OpenSpec changes

## Evidence

- `GOVERNANCE.json` `activeCampaign: null`
- `STATE.md` L5 `Active campaign: none` vs L19–21 "Campaign 028 is active" vs L106–109 Continuation rule
- Constitution L4 "Campaign 028 … active as of 2026-09-13"
- BACKLOG L6–8 "Campaign 027"
- 028 `specs/docs-cleanup/spec.md` D2

## Dependencies

None. Should be applied first among frontier-audit proposals so later implementers do not re-enter 028.

## Intended outcome

A fresh agent reading recovery docs concludes the repository is terminal for the 028 scope and will not re-execute 028 unless the owner authorizes new work.
