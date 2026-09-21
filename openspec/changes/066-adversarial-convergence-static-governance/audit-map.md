# Audit map — 066-adversarial-convergence-static-governance

**Program SHA:** `428d293` · **Predecessor:** `065-adversarial-convergence-runtime-data-pixel` (VALIDATED)

Initial scope (program definition). The recon lanes' verified findings
will populate this table during execution; nothing is accepted into the
task list without reproduction evidence.

| Lane | Candidate surface | Disposition |
|---|---|---|
| static/architecture | import cycles, layer violations, dead exports, generated drift, duplicated canonical logic, contract drift | RECON → verify → fix/record |
| flake/allowlist/debt | skips vs allowlist, quarantine closure criteria, KNOWN_ISSUES/BACKLOG ownership | RECON → disposition |
| governance/state | dashboard/ledger/change.json reconciliation, count accuracy, cursor single-sourcing | RECON → reconcile |
| residual census | Pass A/B/C seed for post-067 hardening | PRODUCE |
| 067 preconditions | final artifact build, six-way pixel/a11y, full device matrix prerequisites | LIST |

## Boundaries

No features, no redesign, no full-hardening execution. Product source is
touched only for minimal repairs of verified static defects.
