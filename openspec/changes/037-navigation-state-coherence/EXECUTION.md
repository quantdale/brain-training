# Execution — Campaign 037 Navigation, State & Cross-Surface Coherence

**Status:** VALIDATED
**Mode:** day
**Start SHA:** `340d61a4fedffb46e8adf8245d57cb03a5831906`
**Authority:** `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`

## Work model

The orchestrator owns the small Home copy branch, route regression contracts,
governance, OpenSpec, evidence, and final convergence. No parallel coder
packet is needed: the observed issue and its protected navigation contracts
are intentionally kept together.

## Final result

Discovery, bounded implementation, and closure validation are complete. The
native 22-surface baseline is retained outside Git under
`D:\Temp\campaign037-runtime-before`; the matching clean after capture is
under `D:\Temp\campaign037-runtime-after-clean`. The source checkpoint is
`ad4e54a` and the evidence package is under
`docs/redesign/evidence/campaign037/`.

## Guardrails

- Do not rewrite Expo Router or introduce a new navigation state layer.
- Preserve session/workout provenance, persistence, migrations, economy,
  backup/restore, empty states, and gameplay.
- Use only the dedicated `emulator-5554` for native validation and keep all
  automation emulator-local.
- Record manual/platform limits as pending rather than inferring them.

## Exit criteria

Clean-state copy is honest and the observed major journeys retain context;
invalid/loading/empty routes remain recoverable; focused/full validation and
matching native evidence are recorded under
`docs/redesign/evidence/campaign037/`. Result: **COMPLETE**. Manual/platform
limits remain explicitly pending for Campaign 038 or later.
