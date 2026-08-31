# Proposal — Campaign 020 Release-QA Convergence

## Decision

Finish the owner-authorized sequence with a release-QA and final hardening
convergence pass. The focus is trustworthy certification signals, source/build
identity, high-confidence secret boundaries, dependency classification, and a
whole-codebase risk audit. No product feature expansion is allowed.

## Starting evidence

Campaign 016 established clean-checkout/native CI, semantic QA interaction
evidence, fail-closed certification behavior, provenance checks, and explicit
Android/manual blockers. Campaigns 017–019 closed local persistence,
engagement, and lifecycle defects. The remaining actionable gap was that the
documented secret scan was not an executable CI gate; 020 adds that gate and
rechecks all release signals on the final source head.

## Completion definition

020 is complete when certification cannot silently pass diagnostic bypasses,
the running/source identity is bound, tracked-file secret patterns fail closed,
dependency findings are classified without unsafe upgrades, and the final
whole-codebase validation evidence is synchronized with an exact pushed SHA.
