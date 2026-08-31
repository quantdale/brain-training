# Audit Map — Campaign 020

| ID | Severity | Area | Required action |
|---|---|---|---|
| Q-01 | High | Certification bypasses | Fail closed on skipped tests, diagnostic bypass flags, and missing final evidence. |
| Q-02 | High | Source/build identity | Bind the running JS/native candidate and artifact evidence to the intended source SHA. |
| Q-03 | High | Security boundary | Make high-confidence tracked-file secret detection executable in CI without leaking values. |
| Q-04 | Medium | Dependency reachability | Reclassify runtime-only findings and remediate only safe compatible fixes. |
| Q-05 | High | Final whole-codebase audit | Re-run affected and full gates; repair newly exposed Critical/High regressions. |

## Evidence separation

CI/build/static evidence cannot substitute for Android runtime, manual
accessibility/system-sheet, physical-device, or manual iOS UX evidence.
