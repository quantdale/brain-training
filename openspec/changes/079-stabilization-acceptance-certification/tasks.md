# Tasks — 079-stabilization-acceptance-certification

## 1. CI recovery and validator contracts

- [x] 1.1 Synchronize with origin and re-verify the reported Repository Integrity failure against current `main` (the `--self-test` parser regression was already repaired at `2f18738f`; four workflows green at `64c1df4d`).
- [x] 1.2 Exercise `validate-affected.mjs` CLI locally: `--self-test` (16/16), `--check-sync`, `--list-areas`, `--help` exit 0; unknown flag exits 2 with usage; root-independent invocation verified.
- [x] 1.3 Add an automated validator CLI-contract gate (documented flags vs parser-recognized flags vs GitHub Actions invocations) with negative tests, wire it into Repository Integrity, and declare it in GOVERNANCE.json's enforced gate set — validate-cli-contracts.mjs (self-test 12/12 incl. negative proofs); 8 silently permissive parsers hardened to usage-error/exit-2.
- [x] 1.4 Build the workflow-to-script invocation compatibility matrix and prove documented, locally exercised, and CI-invoked flags agree — emitted by the gate each run (--json for machine form); all 15 scripts in agreement at 9c4dd138.

## 2. Governance and evidence reconciliation

- [x] 2.1 Reconcile stale claims in `.agent` state, validation, and reports against current source and actual hosted outcomes — independent evidence audit found 9 findings (2 P1, 6 P2, 1 note set); all corrected with date-scoped annotations preserving history.
- [x] 2.2 Re-run strict OpenSpec validation and the generated spec store drift check at the final revision — 205/205 strict; spec store 141 capabilities, --check clean.
- [x] 2.3 Produce the authoritative certification matrix (gate, requirement, procedure, revision, environment, result, evidence, limitation) — docs/certification/079-release-certification/release-matrix.md.

## 3. Product acceptance and corrections

- [x] 3.1 Determine available runtime tooling and exercise the actual Android app on the dedicated AVD (startup, navigation, representative game journeys, persistence, offline) — HOME/Games discovery/detail/tutorial/interactive demo/difficulty/round play/timeout feedback/round advancement journeyed with screenshot+hierarchy evidence; upgrade-install preserved owner data; correct-tap scoring, pause/quit, offline airplane and background/relaunch NOT re-validated this session (recorded in product-acceptance.md).
- [x] 3.2 Review open product findings (gameplay, UX, accessibility, responsiveness) and classify KEEP / REFINE / REDESIGN / REBUILD with severities — reviewed surfaces KEEP; 078-era P3 REFINE candidates unchanged; no P0/P1/P2 found; tooling P3 (uiautomator latency vs round timers) recorded.
- [x] 3.3 Correct confirmed actionable defects with regression coverage; record what remains NOT VALIDATED — no new actionable product defect surfaced; evidence-reconciliation defects (9) fixed with governance suites green; unvalidated paths enumerated in product-acceptance.md §5.

## 4. Performance evidence

- [x] 4.1 Run the bounded performance probes and record environment, samples, and limitations (no invented thresholds) — 5/5 probes written to scripts/perf/baselines/; emulator measurements (cold start 2.9 s, PSS 238 MB, jank 47.5%, p95 101 ms) recorded in performance.md with all limitations.

## 5. Security remediation

- [x] 5.1 Refresh `npm audit` evidence and classify every unique GHSA (13 npm advisory ids → 10 unique GHSAs before remediation).
- [x] 5.2 Remediate `brace-expansion` (3 GHSAs) via in-range lockfile update 1.1.18→1.1.21 / 5.0.9→5.0.12; re-verify with the dependency gate (7 accepted remain).
- [x] 5.3 Re-verify every remaining acceptance against the live registry (`braces`, `node-forge`, `sprintf-js` still unfixed upstream; `image-size`, `uuid`, `decode-uri-component` fixes out of parent semver range) and add owner/review/exit/remediation fields to the register.

## 6. Release governance

- [x] 6.1 Audit workflow enforcement (PR vs push triggers, advisory vs required, skip/hide conditions, stable check names) — all four workflows run on PRs; check names verified via the checks API; shell-hygiene gate prohibits masking constructs.
- [x] 6.2 Configure and verify branch protection on `main` — required checks (4, strict up-to-date), force-push and deletion blocked for everyone via ruleset 25523614 (no bypass actors), explicit admin-bypass policy and integration procedure recorded in GOVERNANCE.json, AGENTS.md, and docs/certification/079-release-certification/governance.md.

## 7. Platform certification and handoff

- [x] 7.1 Produce the final release matrix with per-platform verdicts (GO / CONDITIONAL GO / NO GO / BLOCKED_EXTERNAL / NOT VALIDATED) — release-matrix.md §E: overall CONDITIONAL GO, verdicts separated per dimension.
- [x] 7.2 Produce the executive final report, CI recovery report, product acceptance matrix, performance report, security report, governance report, and next-operator handoff — all under docs/certification/079-release-certification/.

## Closure note

Every task is complete or its remainder is an explicitly recorded external
limitation (physical/iOS-runtime/screen-reader certification, owner
acceptance, 41/42 fresh native re-execution, scheduled-only gates). Those
remainders are not achievable in this environment and are documented in
release-matrix.md and handoff.md. Campaign closes VALIDATED with explicit
limitations, consistent with the repository's established convention.
