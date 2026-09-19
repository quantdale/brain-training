## Why

Campaign 053 left a technically strong repository with a small number of
durable inconsistencies and unclosed observations: its terminal commit message
and its own documentation disagreed about the validation counts, runtime
evidence was built from an implementation checkpoint rather than the final
tree, several older known-issue entries still read as current although later
campaigns had closed them, two runtime observations (first-install startup and
the Android Files import provider) had never been re-tested on the exact final
artifact, external CI and dependency dispositions needed a current refresh,
and the OpenSpec status of campaigns 045-049 was stale. Carrying those forward
would make the next product campaign start from an unclear baseline.

## What Changes

- Build one authoritative gap census with an explicit disposition taxonomy
  (`CLOSED_VERIFIED`, `SUPERSEDED_CLOSED`, `ACCEPTED_TIME_BOUNDED_DEBT`,
  `EXTERNAL_BLOCKER_VERIFIED`, `MANUAL_PLATFORM_PENDING`,
  `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`, `OPEN_PRODUCT_DEFECT`).
- Reconcile the Campaign 053 validation-count mismatch from the authoritative
  current full suite and correct every durable copy without rewriting history.
- Prove exact final product/source SHA provenance and re-verify the release
  APK identity, including a forced re-bundle and hash comparison.
- Re-test first-install/cold-start startup and the system Files import picker
  on the exact release artifact with bounded repeated samples.
- Refresh the external CI classification and dependency/security dispositions
  with current evidence, applying only a safe in-range remediation.
- Inventory and execute every safe opt-in probe; verify allowlists,
  exemptions, and the unexpected-console baseline.
- Reconcile governance/OpenSpec/state to one current truth and run the full
  repository matrix plus an adversarial second pass before a terminal ledger
  and verdict.

## Must Not Change

- No new product features, redesign, scoring/economy semantics, schema, or
  router architecture.
- No workflow YAML edits to mask external CI failures.
- No broad dependency upgrades or audit-force churn.
- No fabrication of human/platform/store evidence.
- No rewriting of historical evidence to look uniform.
