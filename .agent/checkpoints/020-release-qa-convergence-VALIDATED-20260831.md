# Campaign 020 — Release-QA Convergence

**Status:** VALIDATED — terminal repository state  
**Validation date:** 2026-08-31  
**Source state:** `388e10f` (`hardening: close campaign 019 and activate 020`)  
**Successor:** none

## Result

Campaign 020 completed the owner-requested final release-QA and whole-codebase
hardening pass. No product breadth, new game, cloud system, signing, or
unsafe dependency churn was introduced.

The release boundary now includes an executable, fail-closed secret scanner
for Git-tracked text files. It recognizes only high-confidence private-key and
provider-token formats, reports file/line/pattern metadata without matched
values, and has positive/negative self-tests wired into Repository Integrity.
Certification/source-identity and semantic-interaction boundaries were
re-audited; diagnostic clean-checkout options remain explicitly
non-certifying.

## Final validation evidence

| Gate | Result |
|---|---|
| Repository state, task ownership, OpenSpec | PASS — 7/7 OpenSpec changes |
| Generated registry, provenance, offline boundary | PASS |
| Secret scanner | PASS — self-test; CLEAN over 1826 tracked text files |
| TypeScript and lint | PASS — 0 lint errors / 0 warnings |
| Full Node 22 Jest | PASS — 490/494 suites, 6096/6101 tests, 5 snapshots; 4 suites / 5 tests skipped by the explicit measurement allowlist |
| Expo web export and Doctor | PASS — 20 static routes; 21/21 checks |
| QA harness self-test | PASS — 51/51 |
| Full/runtime-only dependency audit | NOT GREEN — identical accepted 16 build/dev-toolchain findings (12 moderate, 4 high), no production/runtime-reachable finding |
| Clean-checkout certification from current workspace | EXPECTED FAIL-CLOSED — inherited `node_modules`/`.expo` rejected; no diagnostic invocation was treated as a release PASS |
| Android runtime, manual platform, physical-device, manual iOS UX | BLOCKED / NOT VALIDATED — documented emulator/toolchain and access constraints |

## Second whole-codebase hardening report

The final review rechecked persistence, sync, temporal reads, engagement,
shared game lifecycle, timers, Workout V3 provenance, catalog reconciliation,
certification scripts, source identity, generated/config boundaries, offline
surface, permissions, and dependency reachability. No new in-scope
Critical/High regression was found. The accepted dependency findings remain
build/dev-toolchain-only and are deferred to a compatible Expo ecosystem
upgrade; no `npm audit fix --force` churn was applied.

## Durable transition

Campaign 020 OpenSpec metadata and tasks, governance, state, ownership, current
campaign, execution prompt, known-issues, validation evidence, dependency
triage, and this checkpoint were synchronized. `main` is terminal with no
active campaign; Android/manual limitations remain explicit non-PASS evidence.
