# Design — 066-adversarial-convergence-static-governance

## Reconnaissance first

Three independent read-only lanes (static/architecture/contract,
flake/allowlist/debt, governance/state) attack the 065-closed tree.
Findings are re-verified before entering `audit-map.md`; accepted
findings become tasks in this change. The spec above defines the
invariants; the task list below is the initial skeleton and will be
refined by the recon (same protocol as 065).

## Static lane focus

- import graph cycles and cross-layer imports that violate the
  architecture rules in `docs/ARCHITECTURE.md`;
- generated artifacts (`registry.generated.ts`, derived indexes) drift;
- duplicated canonical logic (scoring/normalization/schedule helpers)
  introduced by independent game modules;
- dead exports and unreachable modules that mislead future work;
- type/runtime contract drift (declared optional fields always present,
  narrowing casts, `as unknown as` clusters).

## Flake/allowlist/debt lane focus

- every `describe.skip`/`it.skip`/opt-in gate against the reviewed
  allowlist;
- quarantine candidates with closure criteria;
- KNOWN_ISSUES/BACKLOG expiry and ownership completeness.

## Governance lane focus

- reconcile every durable-state field against git reality;
- confirm 056–065 change.json verdicts and validation notes match the
  matrix counts;
- ensure the active-program cursor is single-sourced (065 closure added
  the ledger cross-check).

## Residual census

`docs/redesign/evidence/campaign066/RESIDUAL_CENSUS.md` with Pass A/B/C
sections; the pre-067 boundary list from 065 feeds Pass B/C, and the
static findings that are design decisions rather than defects feed
Pass A.

## Evidence layout

`docs/redesign/evidence/campaign066/`: `CRITIC_FINDINGS.md`,
`RESIDUAL_CENSUS.md`, `GOVERNANCE_RECONCILIATION.md`,
`CAMPAIGN066_CLOSURE.md`; raw logs under `D:\Temp\campaign066-*`.
