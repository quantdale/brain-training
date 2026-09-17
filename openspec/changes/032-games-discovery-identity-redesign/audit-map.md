# Audit map — Campaign 032

## Baseline

- Start SHA: `fa29742f08636b455f23a90c27cec61798fb1024`.
- Before context: Campaign 031 Games/Game Detail state and the preserved
  evidence package under `docs/redesign/evidence/campaign031/**`.

## Changed seams

| Surface | Source of truth | Required proof |
| --- | --- | --- |
| Games hierarchy | Games route and existing discovery snapshot | focused state tests, light/dark pixels |
| Recommendation | personalization scoring/explainers | deterministic order/reason tests, no competing shelves |
| Catalog/cards | generated registry and GameCard | 42-entry registry/provenance checks, identity matrix |
| Favorites/mastery | existing SQLite helpers/hooks | populated/empty/filter tests, persistence replay |
| Game Detail | existing definition, aggregate, recent, mastery seams | Play-before-history tests, eight-family standalone entry |
| Accessibility | shared Button/Chip/TextField/Tappable semantics | hierarchy audit, target/content-size checks |
| Offline | local DB and registry-only reads | offline/security validators, native offline capture |

## Protected contracts

Catalog IDs and generated registry output, lazy loaders, game definitions,
SQLite schema/version, favorite writes, mastery derivation, tutorial/session
behavior, workout eligibility, scoring/generator metadata, and mechanics remain
unchanged; they are evidence obligations rather than redesign seams.
