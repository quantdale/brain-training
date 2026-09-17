# Design — Campaign 036

## Evidence-led finding

The clean-install captures under `D:\Temp\campaign036-runtime-before` and
`D:\Temp\campaign036-runtime-before-all` are route-verified light/dark
surfaces from a cleared dedicated Android emulator. Home has a clear primary
Start workout action and the empty Progress/Game Detail states are honest. The
Data Management clean state reads `Empty` for the storage metric while its own
caption reports `Profile present · 1 workout instance · 9 quest rows`.
Rewards reports `3/12 cosmetics collected` but gives no context for the three
default-owned items. These are narrow comprehension seams, not evidence for a
new onboarding system.

## Bounded treatment

| Surface | Observed ambiguity | Treatment | Protected behavior |
| --- | --- | --- | --- |
| Home / Today's Workout | no explicit local/offline reassurance | one compact trust line inside the existing hero | workout selection, CTA route, session identity |
| Data Management hero | unsupported storage-size fallback says `Empty` despite seeded local state | show `Ready` when local state exists but byte metrics are unavailable | exact counts, wipe/restore/export semantics |
| Rewards / Collection | starter defaults look like earned progress | one explanatory line for the included starter set | cosmetic definitions, ownership, coins, equip/buy flow |

The copy is static, factual, and secondary to the primary action. No new
persisted flags or first-run branching are introduced.

## Risk controls

- Keep all existing test IDs and navigation/action labels.
- Derive the Data Management display from the already loaded count snapshot;
  never change the count query or storage engine.
- Add focused screen contracts for the new trust/status copy.
- Run typecheck, lint, focused/full tests, relevant repository validators,
  native clean-install light/dark captures, accessibility, and fresh logcat.
- Compare matching before/after pixels and document development warm-up or
  platform limits instead of inferring unsupported evidence.
