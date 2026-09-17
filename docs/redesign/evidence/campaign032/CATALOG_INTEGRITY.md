# Campaign 032 catalog and protected-contract integrity

## Registry truth

- Current generated registry contains **42** entries.
- Primary category distribution is Attention 5, Memory 7, Speed 5, Math 5,
  Language 5, Logic & Problem Solving 5, Flexibility 5, and Spatial 5.
- `node scripts/generate-game-registry.mjs --check`: **PASS**, generated output
  is up to date.
- `node scripts/validate-provenance.mjs --check`: **PASS**; no changed game
  definitions require provenance/version drift.
- The identity matrix in `GAME_IDENTITY_MATRIX.md` maps every current registry ID
  to one of the eight shared identity families.

The generated file `apps/mobile/src/registry/registry.generated.ts` and every
`apps/mobile/src/games/**` module were left unchanged. Identity metadata is
keyed by durable ID and is presentation-only; the category fallback remains for
fixtures without catalog metadata.

## Protected behavior checks

| Contract | Evidence | Result |
| --- | --- | --- |
| Catalog membership/uniqueness | `src/sdk/__tests__/catalog/registry-membership.test.ts`, `catalog-uniqueness.test.ts`, `catalog-contracts.test.ts` | PASS |
| Content/metadata integrity | content registry and catalog-integrity suites | PASS |
| Lazy loading / route IDs | registry and app route tests; no loader or game module diff | PASS |
| Favorites persistence | favorites tests plus native favorite → Favorites → unfavorite replay | PASS |
| Mastery semantics | mastery engine and pushdown suites; detail aggregate rendering tests | PASS |
| Tutorial/session behavior | tutorial persistence, Game Detail, GameHost/session suites | PASS |
| Workout eligibility | catalog membership and workout selection suites; `language-word-match` remains catalog-visible and source eligibility rules remain unchanged | PASS |
| Offline boundary | `node scripts/validate-offline.mjs --check` | CLEAN |
| Schema/migrations | no schema, migration, persistence, or data-portability source diff | PRESERVED; no schema change |
| Dependencies/CI | no package manifest, lockfile, dependency, or workflow diff | PRESERVED; no maintenance churn |

## Scope audit

The Campaign 032 product diff is limited to Games discovery, cards, shared
identity presentation, Game Detail, focused tests, governance/OpenSpec, and
evidence. No Home, Progress, Profile, Rewards, economy, scoring, generator,
reducer, timer, workout-selection, SQLite schema, dependency, or CI redesign was
absorbed.

