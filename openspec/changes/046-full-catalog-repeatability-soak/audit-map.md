# Audit Map — Campaign 046

| Area | Evidence | Required check |
| --- | --- | --- |
| 42-game roster | `apps/mobile/src/registry/registry.generated.ts` | generated registry and catalog contract tests |
| Detail/start/first state | `docs/redesign/evidence/campaign046/` | current Android route captures/hierarchy |
| Result lifecycle | campaign matrix with evidence class | legitimate result or explicit partial classification |
| Persistence | disposable/dedicated DB query output | integrity, duplicate, idempotency checks |
| Repeat interaction | eight-domain subset log | real interaction distinguished from deterministic QA |
| Runtime health | filtered logcat and ARTEMIS trace | no app fatal/RedBox/invariant error |
