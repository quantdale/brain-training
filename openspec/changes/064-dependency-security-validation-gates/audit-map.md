# Audit map — 064-dependency-security-validation-gates

**Program SHA:** `428d293` · **Predecessor:** `063-release-candidate-runtime-matrix` (VALIDATED)

Census claim → verification → disposition (all verified at HEAD before
the spec was written; no claim taken on trust):

| Census claim | Verification | Disposition |
|---|---|---|
| KNOWN_ISSUES ReDoS expiry contradicts allowlist | `2026-12-31` vs allowlist/DEPENDENCY_AUDIT `2027-03-31` | FIX (doc alignment + owner) |
| Provenance allowlist expiry is a silent time-bomb | entries expire `2026-11-11`; validator only treats expired as absent during drift checks | FIX (`--check-allowlist`) |
| 5 permanent opt-in skips with no expiry | schema v2 has owner/reviewedAt only; no expiry field | FIX (schema v3 + enforcement) |
| Offline gate misses specifier-only imports + runtime ban narrower than static list | `import { get } from 'axios'` invisible after string stripping; ban patches 3 globals | FIX (specifier scan + EventSource/sendBeacon) |
| Secrets scanner 6-pattern | verified 6 patterns | FIX (npm/Google/Stripe) |
| analytics/quests/achievements/streaks/theme lack affected-area rules | verified present; no rules | FIX (rules + mirror + self-test) |
| `--strict` wired nowhere | only check-sync/list-areas in CI | FIX (self-test pins semantics; documented orchestrator use) |
| Console gate error/warn-only; `max:1`; global state | guard wraps error/warn only; 9 deliberate log sites (6 emitters, 1 dead, 1 `[perf]` that fires under jest) | FIX (all levels; emitters scoped; `[perf]` suppressed under jest only; `max:1`/state boundaries reviewed) |
| Local-vs-CI install/test divergence | CI runs `npm ci`; local uses node_modules | DOCUMENT (external/architectural); lockfile is canonical |
| Network gates flap BLOCKED + audit absent from App CI | audit runs in repository-integrity (network) by design; App CI hermetic | DOCUMENT ownership (no duplicate network gate) |
| Native smoke x86_64-only + 2-permission check | `-PreactNativeArchitectures=x86_64`; two blocked-permission greps | FIX (deny-by-default permission set); arch matrix stays 067/RUNTIME |
| Runtime-QA contract string-presence only | substring + file existence, no parse/resolve/self-test | FIX (structural + resolver + self-test) |
| `testMatch` ignores `*.spec.*` | only `.test.ts(x)`; zero spec files exist today | FIX (include spec + guard test) |
| Provenance watches `games/**` identity only | intentional identity scope; registry guarded separately | DOCUMENT (non-goal) |
| Probe runner covers 2/5 probes | verified 2 of 5 opt-in probes wired | FIX (5/5 + `--list`) |
| Jest SQLite backend diverges from native adapter | test-only Node backend by design; device certification compensates | DOCUMENT (non-goal) |
| Async/timer flake surface | not a repository-owned gate defect | DEFER to 065/067 critic passes |

## Boundaries

Product behavior, schema v12, scoring/economy, routing, and the empty
console baseline are protected. External CI account/policy, iOS,
physical/OEM, store signing, and human provider usability remain
EXTERNAL/MANUAL and are not claimed here.
