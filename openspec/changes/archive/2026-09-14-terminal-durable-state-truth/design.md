## Context

`validate-repo-state.mjs` parses only structured fields (`**Active campaign:**`, `**Status:**`, GOVERNANCE JSON). Surrounding Markdown can still instruct agents to execute 028. 028 D2 required one coherent status; W5 wrote "028 active" while the campaign was running; W7 flipped structured fields to VALIDATED and left the prose.

This change is documentation-only. A spec exists because `@fission-ai/openspec@1.6.0` rejects zero-delta changes.

## Goals / Non-Goals

**Goals:** recovery-plane current-status prose matches `activeCampaign: null`.

**Non-Goals:** product code; activating 029 as a campaign; rewriting historical VALIDATION evidence; flipping old EXECUTION.md headers in 015–027.

## Decisions

1. **STATE.md Continuation rule** becomes: no active campaign; do not execute 028; owner must authorize the next OpenSpec change / campaign. Keep recovery order, pointing at GOVERNANCE first.
2. **CURRENT_CAMPAIGN.md** keep `**Status:** VALIDATED` and replace `(ACTIVE)` with closed/terminal wording; mission section stays as historical record labeled as such.
3. **Constitution / MASTER_PLAN / GOAL / KNOWN_ISSUES / BACKLOG** current-status sentences name terminal 028, not an active 027/028.
4. **Do not change GOVERNANCE.json** except if a comment/doc quotes it (it is already correct).
5. **Repo-state tests** that pin prose should be updated only if they assert the old sentences; prefer not to make the validator parse prose (015 already rejected that).

## Risks / Trade-offs

- Agents that only read CURRENT_CAMPAIGN mission body may still see imperative language — mitigate with a one-line **Terminal** callout at the top (already has Status VALIDATED).

## Testing strategy

- `node scripts/validate-repo-state.mjs` PASS.
- Grep recovery files for "Campaign 028 is active" / "Campaign 027 is active" in current-status headers (historical evidence in VALIDATION.md may remain).
