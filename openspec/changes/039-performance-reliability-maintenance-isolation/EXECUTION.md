# Execution — Campaign 039 Performance, Reliability & Maintenance Isolation

**Status:** VALIDATED
**Mode:** day
**Start SHA:** `9672c07`
**Authority:** `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`

## Work model

The orchestrator owns the measurement plan and any shared reliability seam.
No parallel coder packets are active. Dependency work, if justified, must be
kept in a separate commit from product changes.

## Current result

Campaign 038 is terminally validated for the tested Android scope. Campaign
039 starts from its pushed checkpoint and must establish current performance
and reliability truth before changing code.

The measurement pass found no reproducible redesign-created source
performance regression that justified a speculative optimization. It did
find that the repository's Expo SDK 57 patch dependencies had drifted from
the installed compatible patch set. That maintenance slice was refreshed in
the package manifest/lockfile only, then rebuilt and exercised on the
dedicated Android runtime. No schema, persistence, session, workout,
gameplay, router, or CI change was made.

## Guardrails

- Use only the dedicated `emulator-5554` / `braintraining-ui35` target.
- Do not optimize without a reproducible observation or measurement.
- Do not change schema, migrations, economy, session/workout identity,
  gameplay, offline boundaries, or router architecture.
- Do not edit CI workflows to hide external zero-step failures.
- Record unavailable iOS, physical-device, human, and external evidence as
  NOT VALIDATED or external rather than inferring success.

## Terminal result

Campaign 039 is **COMPLETE for the tested Android/repository scope** at the
source maintenance checkpoint recorded in the evidence package under
`docs/redesign/evidence/campaign039/`. This is not a claim of human, iOS,
physical-device, production-signing, or external-CI certification.

## Exit criteria

No known redesign-created material performance/reliability regression remains;
any maintenance change is isolated and evidence-backed; measurements,
runtime logs, validation, and platform limits are recorded under
`docs/redesign/evidence/campaign039/`. Result must be COMPLETE or PARTIAL
truthfully.
