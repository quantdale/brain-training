# Tasks — 057-result-reward-correctness

- [x] 1. Orchestrator shared pieces: `rating/xp-hook.ts` + parity test; stale Phase-2 comment fix; PB `toMs` clamp + skew/outcome test; strict pre-validation.
- [x] 2. Packets 1–7 (attention/flexibility/language/logic/math/memory/spatial): per-game clamp collapse + hook swap + parity check + suites green.
- [x] 3. Packet 8 (speed) + memory retry after first completions (7-coder ceiling respected).
- [x] 4. Orchestrator convergence: catalog 361/4,281 green; adversarial CLOSE_WITH_FIXES repaired (spec narrowed, PB outcome test, bestOf stack-safety ×5 sites, audit-map de-overclaimed).
- [x] 5. Terminal: full matrix post-fixes (569 suites / 6,810 tests / 5 snapshots, exit 0); canary PARTIAL (debug build, Metro bundle 1729 modules clean, device load initiated, zero JS errors, frame stall documented); durable state, commit, push, `HEAD == origin/main`.
