# Design — Campaign 020 Release-QA Convergence

## Signal boundaries

- Certification skips and non-pass outcomes are explicit and fail closed.
- Runtime/source identity is tied to the candidate SHA before UI evidence is
  trusted; semantic gameplay state changes, not timer churn, prove interaction.
- The repository secret check scans Git-tracked text using high-confidence
  provider/key formats and never prints matched values.
- Dependency audits remain reachability-classified; no incompatible major
  upgrade is made merely to reduce advisory counts.

## Final audit

Run repository-state, ownership, OpenSpec, registry, provenance, offline,
secret, typecheck, lint, full Node 22 Jest, web/export or doctor checks where
available, QA self-tests, dependency audits, and relevant native/build smoke
checks. Android runtime, manual accessibility/system sheets, physical-device,
and manual iOS UX remain separate evidence and must retain BLOCKED/NOT
VALIDATED classifications when unavailable.
