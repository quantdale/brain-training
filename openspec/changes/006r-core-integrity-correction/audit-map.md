# Audit Finding -> OpenSpec Requirement Map

| Finding | Severity | Capability |
|---|---:|---|
| App CI/typecheck red at audited checkpoint | P1 | autonomous-governance / tasks 0 |
| Lowercase SDK difficulty vs capitalized rating maps | P1 | progression-rating |
| Continuous/adaptive challenge ignored by rating policy | P1 | progression-rating |
| Local result can show 0 XP while DB stores real XP | P1 | progression-rating |
| Historical derived ratings may be wrong | P1 | progression-rating |
| Content/generator pool changed without version bump | P1 | content-provenance |
| No machine version-drift guard | P1/P2 | content-provenance / autonomous-governance |
| Word Match has multiple legitimate synonyms per question | P1 | language-word-match |
| Equation Builder curated template can be unsolvable under Easy operators | P1 | math-equation-builder |
| Generator fallback not final-validator-gated | P1 | math-equation-builder |
| Tutorial state defaults to in-memory | P1/P2 | tutorial-lifecycle |
| Today's Workout is four links, not a workflow | P1 product | daily-workout |
| Personalization only reorders selected four | P1/P2 | daily-workout |
| Reroll state resets on restart / debit-state crash gap | P2 | daily-workout / economy-transactions |
| Purchase can debit without granting item | P2 | economy-transactions |
| Claim can be marked without reward | P2 | economy-transactions |
| UI-only affordability permits races/negative balance | P2 | economy-transactions |
| Local autoincrement transaction identity not merge-safe | P2 | economy-transactions / database-integrity |
| Missing cheap DB constraints | P2 | database-integrity |
| Older code can open newer schema | P2 | database-integrity |
| DB structured version fields collapse semver | P2 | database-integrity / content-provenance |
| Rating history stores requested rather than actual floor-limited delta | P2 | progress-analytics |
| Rating freshness may use processing instead of evidence time | P2 | progress-analytics |
| Home streak based on only 30 sessions | P2 | progress-analytics |
| Results scans latest global 50 history entries | P2/P3 | progress-analytics |
| Overall composite missing | P2 | progress-analytics |
| `lazy(loader)` component identity created during render | P2 | game-platform |
| Repeated generic game UI causes 20-file cross-cutting edits | P2 | game-platform |
| Audio/haptics production path still no-op; settings transient | P2 | game-platform |
| Pattern Tap Back/Memory mechanics overlap; docs differ from implementation | P2 | full-catalog-gate |
| Swarm task packet write surfaces overlap / omit actual paths | P2 process | autonomous-governance |
| Generated registry direct-edit instruction violated governance | P2 process | autonomous-governance |
| CI lacks lint/registry/provenance/packet semantic gates | P2 process | autonomous-governance |
| 2,000+ tests did not catch semantic integration faults | P1 process | autonomous-governance / full-catalog-gate |
