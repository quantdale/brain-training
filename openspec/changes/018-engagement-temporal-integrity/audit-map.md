# Audit Map — Campaign 018

| ID | Severity | Area | Required action |
|---|---|---|---|
| E-01 | High | Quest progress boundary | Reject non-finite, fractional, unsafe, negative, and malformed identity/time inputs before writes. |
| E-02 | High | Streak calendar | Validate real `YYYY-MM-DD` dates and keep covered-date serialization deterministic. |
| E-03 | High | Reward claims | Apply one validated as-of clock through inbox and direct claims; future events remain unavailable. |
| E-04 | Medium | Progression reconciliation | Prove rollover/catalog-drift reads converge on current SQLite truth without stranded rewards or workout results. |
| E-05 | Medium | Retry/failure behavior | Preserve idempotency and atomicity under repeated engagement actions and injected write failure. |

## Evidence separation

Automated real-DB evidence, Android runtime evidence, manual accessibility and
system-sheet evidence, and physical-device timing evidence remain separate.
Unavailable external checks must stay BLOCKED or NOT VALIDATED.
