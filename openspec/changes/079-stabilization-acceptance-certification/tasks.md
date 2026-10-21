# Tasks — 079-stabilization-acceptance-certification

## 1. CI recovery and validator contracts

- [x] 1.1 Synchronize with origin and re-verify the reported Repository Integrity failure against current `main` (the `--self-test` parser regression was already repaired at `2f18738f`; four workflows green at `64c1df4d`).
- [x] 1.2 Exercise `validate-affected.mjs` CLI locally: `--self-test` (16/16), `--check-sync`, `--list-areas`, `--help` exit 0; unknown flag exits 2 with usage; root-independent invocation verified.
- [ ] 1.3 Add an automated validator CLI-contract gate (documented flags vs parser-recognized flags vs GitHub Actions invocations) with negative tests, wire it into Repository Integrity, and declare it in GOVERNANCE.json's enforced gate set.
- [ ] 1.4 Build the workflow-to-script invocation compatibility matrix and prove documented, locally exercised, and CI-invoked flags agree.

## 2. Governance and evidence reconciliation

- [ ] 2.1 Reconcile stale claims in `.agent` state, validation, and reports against current source and actual hosted outcomes.
- [ ] 2.2 Re-run strict OpenSpec validation and the generated spec store drift check at the final revision.
- [ ] 2.3 Produce the authoritative certification matrix (gate, requirement, procedure, revision, environment, result, evidence, limitation).

## 3. Product acceptance and corrections

- [ ] 3.1 Determine available runtime tooling and exercise the actual Android app on the dedicated AVD (startup, navigation, representative game journeys, persistence, offline).
- [ ] 3.2 Review open product findings (gameplay, UX, accessibility, responsiveness) and classify KEEP / REFINE / REDESIGN / REBUILD with severities.
- [ ] 3.3 Correct confirmed actionable defects with regression coverage; record what remains NOT VALIDATED.

## 4. Performance evidence

- [ ] 4.1 Run the bounded performance probes and record environment, samples, and limitations (no invented thresholds).

## 5. Security remediation

- [x] 5.1 Refresh `npm audit` evidence and classify every unique GHSA (13 npm advisory ids → 10 unique GHSAs before remediation).
- [x] 5.2 Remediate `brace-expansion` (3 GHSAs) via in-range lockfile update 1.1.18→1.1.21 / 5.0.9→5.0.12; re-verify with the dependency gate (7 accepted remain).
- [x] 5.3 Re-verify every remaining acceptance against the live registry (`braces`, `node-forge`, `sprintf-js` still unfixed upstream; `image-size`, `uuid`, `decode-uri-component` fixes out of parent semver range) and add owner/review/exit/remediation fields to the register.

## 6. Release governance

- [ ] 6.1 Audit workflow enforcement (PR vs push triggers, advisory vs required, skip/hide conditions, stable check names).
- [ ] 6.2 Configure and verify branch protection (or ruleset) on `main` with required status checks, or document the exact external blocker.

## 7. Platform certification and handoff

- [ ] 7.1 Produce the final release matrix with per-platform verdicts (GO / CONDITIONAL GO / NO GO / BLOCKED_EXTERNAL / NOT VALIDATED).
- [ ] 7.2 Produce the executive final report, CI recovery report, product acceptance matrix, performance report, security report, governance report, and next-operator handoff.
