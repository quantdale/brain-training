## ADDED Requirements

### Requirement: Recovery prose matches terminal governance
While `GOVERNANCE.activeCampaign` is null and `lastCampaignStatus` is VALIDATED, current-status prose in STATE, CURRENT_CAMPAIGN, KNOWN_ISSUES, BACKLOG, GOAL, the constitution Implementation line, and MASTER_PLAN MUST NOT describe 027 or 028 as the active campaign. The STATE continuation rule MUST NOT instruct agents to execute 028.

#### Scenario: STATE continuation
- GIVEN GOVERNANCE.activeCampaign is null
- WHEN a reader follows STATE.md Continuation rule
- THEN they are told there is no active campaign and not to execute 028

#### Scenario: Constitution status line
- GIVEN the same terminal governance
- WHEN a reader opens docs/PROJECT_CONSTITUTION.md Implementation status
- THEN it names 028 as VALIDATED/closed, not active

### Requirement: Structured fields stay terminal
This change MUST NOT set GOVERNANCE.activeCampaign to a new id.

#### Scenario: Governance remains unbound
- GIVEN this change is applied
- WHEN validate-repo-state runs
- THEN activeCampaign is still null and lastCampaign remains 028-production-readiness VALIDATED
