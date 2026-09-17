# Campaign 040 catalog, copy, and debt audit

## Catalog

- `node scripts/generate-game-registry.mjs --check`: PASS; generated registry
  contains 42 stable IDs.
- Runtime scroll scan: 42 distinct base card IDs observed, including the full
  Memory, Attention, Speed, Math, Language, Logic & Problem Solving,
  Flexibility, and Spatial groups.
- Runtime category chips: All 42; Memory 7; each of Attention, Speed, Math,
  Language, Logic & Problem Solving, Flexibility, and Spatial 5; Favorites 0.
- Runtime search: `memory` → 7 of 42, with `game-card-memory` present.

The runtime evidence establishes catalog identity and discovery extent. It does
not claim a manual playthrough of every mechanic.

## Unsupported-claim scan

The source scan was:

```text
rg -n -i "(improv|boost|enhanc|intelligen|neurolog|cognit|memory|focus|brain|IQ|medical|clinical|therap|diagnos|prevent)" apps/mobile/src --glob '!**/__tests__/**'
```

Matches were classified as game/category vocabulary, factual interaction copy
(for example, repeating a pattern “from memory”), internal rating or
personalization terminology, diagnostics, or in-memory test/persistence
implementation names. No direct efficacy, intelligence, neurological,
clinical, therapeutic, diagnostic, IQ, or medical promise was found in the
current player-facing source.

## Debt review

The current `TODO|FIXME|NEEDS_PARENT|deprecated|obsolete` scan found no active
player-facing TODO/FIXME cleanup target. Existing `NEEDS_PARENT` references are
historical database/analytics comments, and the React Native shadow-prop
deprecation comment records a platform warning rather than a Campaign 040
regression. Existing actionable debt remains explicit rather than being
speculatively removed:

- external GitHub workflows currently fail before executing steps;
- independent human, TalkBack/VoiceOver, iOS, physical-device, signing, and
  document-sheet evidence is unavailable;
- the dev lazy-loading warm-up and compact-runner false-blank limitations from
  earlier campaigns remain documented;
- dependency audit retains five reviewed advisories (including the accepted
  runtime `decode-uri-component` entry).
