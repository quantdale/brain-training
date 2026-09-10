# Audit Map — Campaign 023

Working record for research findings, per-game audit dispositions, and
verification evidence. This file is the campaign's living evidence log.

## Phase 1 — Refero MCP

| Check | Evidence | Status |
|---|---|---|
| Local MCP config, no token tracked | `.kimi-code/local.toml` + `git check-ignore` | PASS |
| User opencode config MCP entry | `~/.config/opencode/opencode.jsonc` (outside repo) | PASS |
| Live `initialize` | `refero_server 0.2.0`, protocol 2025-06-18 | PASS |
| Live `tools/list` | screens/similar/screen-image/styles/get-style/flows | PASS |
| `refero-design` skill | server offers `npx skills add ...` — requires explicit owner approval; NOT installed | NOT VALIDATED (by policy) |
| Benchmark research queries | see Research Log below | PENDING |
| Reference lock | see below | PENDING |

### Research Log

(pending queries)

### Reference Lock

(pending)

## Phase 2 — Per-game audit dispositions

(one row per registered game: clean / fixed-<sha> / finding-classification)

## Phase 3 — Design & gamification evidence

(pending)

## Phase 4 — Production readiness evidence

(pending)
