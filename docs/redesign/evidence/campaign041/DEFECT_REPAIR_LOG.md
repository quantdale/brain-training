# Campaign 041 Defect and Repair Log

## Repair policy applied

Campaign 041 required reproduce → minimize → root cause → regression coverage → smallest fix → focused validation → broader validation → native re-test → before/after evidence. No product repair was made without completing that chain. No test assertion, allowlist, workflow, persistence format, scoring formula, economy value, session identity, migration, or registry ID was weakened or changed.

## Findings and dispositions

| Finding | Reproduction/evidence | Severity / disposition | Repair |
|---|---|---|---|
| Intermittent workout-load `NativeDatabase.prepareAsync` NPE | `[OBSERVED_RUNTIME]` Seen during one debug matrix run; logcat showed bootstrap success then workout load failure. Cold relaunch recovered; exact replay ended clean. | Medium conditional reliability risk; not minimized to a deterministic case or root cause. | None. A speculative database/workout rewrite would violate the repair policy. |
| Light debug a11y violation | `[OBSERVED_RUNTIME]` 22 identical analyzer hits were the RN LogBox close control; post-reset replay removed LogBox. | Low validation-environment contamination; not a product control defect proven by the evidence. | None. The capture/a11y limitation is documented; release hierarchy must be rerun without the UiAutomation collision. |
| Compact/font-scale Home row clipping | `[OBSERVED_RUNTIME]` compact capture showed approximately 27dp visible row; font-scale-2 showed approximately 19dp visible row. | Low/Medium current accessibility/layout risk; source root cause and intended layout policy were not isolated during this audit. | None in this frozen hardening pass; hand off for a bounded layout decision and regression capture. |
| Release UI hierarchy unavailable | `[BLOCKED]` UiAutomation service already registered; `ui-capture` XML fields null/0 and a11y audit had no dumps. | Tooling limitation, not a product defect established. | None; rerun after service cleanup. |
| Raw npm audit nonzero | `[VERIFIED_TEST]` 20 findings (15 moderate, 5 high) while repository policy validator passed under its allowlist/reachability classifications. | Dependency debt/release decision, not a reproduced app exploit. | None; broad Expo/Router/toolchain upgrade is out of scope without a demonstrated blocker. |
| GitHub Actions four zero-step failures | `[VERIFIED_GIT]` Current and preceding SHA runs fail before steps with no logs. | External pre-step indeterminate; no repository command ran. | None; workflow was not modified to mask it. |

## Repair result

**Product source changed: no.** The current product SHA was fully revalidated as an audit subject; Campaign 041 produced evidence and durable state documentation only. Because no repair was made, there is no unfounded before/after claim.

