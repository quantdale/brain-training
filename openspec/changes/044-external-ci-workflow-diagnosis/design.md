# Design — Campaign 044

Use the current GitHub Actions API as primary evidence for external CI state.
Cross-check run metadata against job records, annotations, workflow source, and
local repository validators. A pre-run account, policy, or runner failure is
recorded as external and does not authorize workflow edits.

| Evidence | Decision |
| --- | --- |
| steps, runner ID/name, timestamps | whether a runner actually started | 
| annotations and check-run details | provider/account/policy cause | 
| workflow source and syntax validators | repository-side defect check | 
| repeated runs across current SHAs | transient versus persistent classification | 
