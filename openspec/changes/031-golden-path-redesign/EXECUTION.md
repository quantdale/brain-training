# Execution — Campaign 031: Golden-path redesign

**Status:** VALIDATED
**Change:** `031-golden-path-redesign`
**Mode:** day
**Start SHA:** `44ba1533f4eb5ebcd795723f801633caee914e17`
**Predecessor:** `029-artemis-runtime-qa-migration` (active checkpoint; external
runtime-provider work remains separately classified)

## Authority and read order

The authoritative task specification is
`.agent/CAMPAIGN031_GOLDEN_PATH_REDESIGN_IMPLEMENTATION_PROMPT.md`. Read it
after `AGENTS.md`, the constitution, and the repository state documents; use
Campaign 030B evidence as the before baseline. Do not begin Campaign 032.

## Work model

This is a cross-cutting shared-surface change owned by the orchestrator. Keep
one normal Android AVD and emulator-local/ADB or ARTEMIS interaction only; do
not hijack host input, touch a user-owned emulator, copy ARTEMIS traces or
credentials into the repository, or add a second gameplay controller.

## Validation order

Run focused changed-surface tests after each vertical slice, then the complete
repository/native matrix required by the Campaign 031 prompt. Capture before
and after real-pixel evidence in light and dark mode, classify unavailable
human/ARTEMIS evidence honestly, update the Campaign 031 evidence package,
close governance/OpenSpec only after exit criteria are evaluated, and commit
and push `main` without force.

## Terminal result

All Campaign 031 product, correctness, native, accessibility, evidence, and
repository exit criteria were evaluated. The final closure package records the
explicit human/ARTEMIS/manual handoffs; Campaign 032 was not started.
