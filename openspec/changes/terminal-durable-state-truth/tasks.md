## 1. Recovery prose

- [ ] 1.1 Rewrite `.agent/STATE.md` Current status + Continuation rule + leftover "Next: W6" to match `activeCampaign: null`.
- [ ] 1.2 Mark `.agent/CURRENT_CAMPAIGN.md` Change line closed/terminal; keep Status VALIDATED.
- [ ] 1.3 Fix `.agent/KNOWN_ISSUES.md` header; `.agent/BACKLOG.md` 027-active lines; `.agent/GOAL.md` current vs historical directives.

## 2. Product docs status lines

- [ ] 2.1 `docs/PROJECT_CONSTITUTION.md` Implementation line: 028 VALIDATED, no active campaign.
- [ ] 2.2 `docs/MASTER_PLAN.md` current-campaign blurb.

## 3. Verification

- [ ] 3.1 `node scripts/validate-repo-state.mjs` PASS.
- [ ] 3.2 Grep current-status headers: no "Campaign 028 is active" / "Campaign 027 is active" outside historical VALIDATION evidence.
- [ ] 3.3 Do **not** set `GOVERNANCE.activeCampaign`.
