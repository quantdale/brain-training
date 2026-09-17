# Execution — Campaign 040 Release-Candidate Integration & Certification

**Status:** ACTIVE
**Mode:** day
**Start SHA:** `174fff6`
**Authority:** `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`

## Work model

The orchestrator owns the integrated audit, native runtime, evidence, and
final governance convergence. No parallel coder packets are active. Product
source changes are allowed only when a current certification journey proves a
bounded severe or release-blocking defect.

## Guardrails

- Use only the dedicated `emulator-5554` / `braintraining-ui35` target.
- Preserve local state and avoid destructive Data Management actions.
- Do not claim all 42 mechanics were manually played unless directly done.
- Do not claim human TalkBack/VoiceOver, iOS, physical-device, signing,
  document-sheet, or external-CI success without direct evidence.
- Do not edit CI workflows to hide failures or reopen locked product choices.

## Exit criteria

Re-observe the integrated product, run the broadest practical local/native
matrix, record catalog/copy/debt review and external/manual limits, repair any
severe regression found, and commit/push one of the truthful terminal labels:
`CAMPAIGN_040_CERTIFIED`, `CAMPAIGN_040_CONDITIONAL`,
`CAMPAIGN_040_PARTIAL`, or `CAMPAIGN_040_BLOCKED`.
