# Campaign 055 Audit Map — Finding to Response

Sources: `docs/redesign/evidence/campaign052/*` (visual debt map, first
impression review, independent critique, reference reality check, committed
pixels), the independent critic's gameplay tension note, and
`.agent/CAMPAIGN055_SIGNAL_ARCADE_DESIRABILITY_PASS_PROMPT.md`.

| Finding | Rank / class | Response | Implementation surface | Evidence |
| --- | --- | --- | --- | --- |
| V-01 Repetitive card grammar across all surfaces | High (cross-product) | Shared container roles: Stage/Panel/Report/Slot; Report replaces stacked cards for records/stats/settings | `components/ui/*`, all refined surfaces | `SURFACE_CHANGE_MATRIX.md`, before/after pixels |
| V-02 Weak focal hierarchy (Home, Profile, Results) | High | One dominant object per surface; enforced by lock §2.1/§2.5/§2.7 | Home, Profile, Results | `VISUAL_CRITIQUE.md` pass A/B |
| V-03 Game fantasy weaker than explanation | High | Code-native Stage scenes with per-domain composition; world visible before metadata | `components/discovery/game-identity.tsx` consumers, Games, Detail, Results | before/after pixels |
| V-04 Typography roles too uniform | Medium | New voices `gameTitle`, `resultHeadline`, `bodyRead`; 900 reserved for 3 voices | `theme/tokens.ts`, all surfaces | `SURFACE_CHANGE_MATRIX.md` |
| V-05 Shape language over-expanded | Medium | Shape-role table; ≤16 dp radii outside pills; no folded-corner containers | shared components | lock §2.3, screenshots |
| V-06 Colour roles carry too many meanings | High | Semantic table; band model for Results; success never used for weak performance | tokens + Results + Profile/Rewards | lock §2.4, Results pixels |
| V-07 Robotic/admin copy ("recorded movement", "next consideration", "rating 986", raw ms, "Local player", "Indigo accent") | High (credibility) | Copy audit and repair; exact replacements recorded | Progress, Games, Results, Profile | `COPY_AND_LABEL_AUDIT.md` |
| V-08 Results feels like a report, not an emotional peak | High | One artifact + band headline + supporting strip + strict action hierarchy | `app/results.tsx`, `components/game-host/results.tsx` | Results before/after |
| V-09 Games feels like a catalog database | High | Storefront: featured stage + poster grid, identity first | `app/(tabs)/games.tsx`, `components/discovery/*` | Games before/after |
| V-10 Profile feels like record management | High | Player identity first viewport; settings/data demoted | `app/(tabs)/profile.tsx` | Profile before/after |
| V-11 Rewards feels like inventory; emoji-as-art | Medium | Collectible grid, code-native objects, quiet locked states | `app/rewards.tsx`, cosmetics presentation | Rewards before/after |
| V-12 Progress reads as analytics software | Medium | Consistency rail first, quiet reports, player language | `app/(tabs)/progress.tsx` (+ drill-down framing) | Progress before/after |
| V-13 Shell stronger than games; gameplay among weakest visually (evidence conflict) | High | Resolve: preserve mechanic-first architecture, raise stage identity, header, tactile feedback | `components/game-host/*`, `components/game-ui/*` | gameplay before/after across 8 domains |
| V-14 Dark-mode tonal separation / dead areas | Medium | Targeted token + composition fixes; keep authored palette | tokens + Results/Home composition | dark before/after |
| V-15 Home dashboard behavior | High | One dominant daily object; stats subordinate | `app/(tabs)/index.tsx` | Home before/after |
| V-16 Game Detail analytics dominance | Medium | Records become Report grammar below the fold | `app/game-detail/[id].tsx` | Detail before/after |
| V-17 Tutorial product-form feeling | Medium | One concept at a time, continuity with the game stage | `components/game-ui/tutorial-frame.tsx`, `components/game-host/game-host.tsx` | tutorial before/after |

## Protected floor (not reopened)

- Campaign 054's zero open repository-owned Critical/High/Medium correctness
  gaps; 564 suites / 6,726 tests; console gate; five opt-in probes; 42-game
  persistence coverage; bootstrap recovery; route envelope; schema v12;
  workout/session identity; reward/currency idempotency; backup/import/export;
  offline; release startup; malformed-route recovery; OpenSpec strict.
- No game mechanism, scoring, timer, generator, difficulty, registry ID,
  workout semantics, XP, currency, reward economy, migration or persistence
  change is authorized by any finding above.
