# Product inventory and current decisions

15 shipping leaf routes, plus development prototype. Source inspection and
fresh baseline captures inform these decisions; loading/error route captures
do not certify every populated or transition state.

| Route / family | Decision | Concrete finding and intended correction |
|---|---|---|
| Home / daily workout | REDESIGN | Giant artwork/charcoal slab and54dp count dominate completed state; useful habits arrive late. Compact context, native title/action before plan, bounded original artwork, honest saved completion |
| Games / search / filters | REDESIGN | Forced minimum2 columns truncates titles at compact/large text; recommendation follows all42. Reflow to rows, early discovery, clear active filters/read errors |
| Game detail | REFINE | Preserve provenance, difficulty and start ownership; strengthen differentiated game identity and concise mechanic introduction |
| Game / tutorials | REDESIGN | Shared stage nests about72dp gutter before game padding; mixed controls/weak semantics. Quiet wider stage, coherent HUD and mechanic-specific boards; fix behavior before acceptance |
| Results / workout complete | REDESIGN | Sparse ring/art consumes space; saved continuation can strand after advance error. Concise honest outcome, useful comparable facts and reachable retry/next action |
| Progress overview | REDESIGN | Overall rating below activity, repetitive Report grammar. Answer-first summary, meaningful trend/calendar, detail one tap away |
| Progress detail | REFINE | Preserve transparent metric bands/history; simplify hierarchy and use shared type/icon roles |
| Progress activity | KEEP/REFINE | Useful frequency/calendar already exists; improve labels and surrounding hierarchy |
| Progress domain | REFINE | Preserve interpretation/history; consistent domain identity and readable comparisons |
| Progress game | REFINE | Preserve records/version context and history; align typography/empty/error presentation |
| Rewards / quests / achievements | REDESIGN | Three-column minimum and repeated generic effects; improve responsive collection and earned-state distinctions |
| Profile / preferences | REDESIGN | Crowded identity/faint XP and long mixed-purpose stack. Purpose-grouped identity, play preferences, appearance and data |
| Data management / import / backup | REBUILD presentation | Preview/consent stale-state safety repaired first. Group decisions, keep engine/schema unchanged, clear validation/apply context and safe destructive confirmation |
| Storage unavailable | REFINE | Preserve recovery-safe backup path and honest failure; clearer typography/action hierarchy |
| Bootstrap recovery | REFINE | Preserve classified foundational stages/retry; align recovery composition |

KEEP: atomic SQLite/session/economy/workout contracts, offline loading, safe back
fallbacks, opaque fair pause, shared press feedback, useful calendar/frequency
visualization, transparent performance bands, existing game identities.

System findings: Expo template launcher/adaptive/splash images; mixed
SF/Material/text glyph/emoji/Spark functional vocabulary; system fonts with
overused800 weight; same oversized Report/hairline composition across product;
generic repeated game illustrations. Play Lab reference lock replaces the
visual authority while protecting semantic domain colors and measured contrast.

## Fresh baseline evidence

Local `qa-artifacts/campaign077/baseline/routes-default/manifest.json`:30/30
frames (15 routes×light/dark). `routes-profiles/manifest.json`:120/120
(15 routes×4 profiles×2 themes): compact, font-scale-2, expanded and reduced
motion. No aborted frame; resolved theme is known for all150 via the exact
APK-bound persisted system preference witness and live Activity configuration,
not brightness. Reduced-motion transition scale observed0. Source/install APK
SHA256 c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6.

Baseline SQLite db/wal/shm and APK are preserved locally before changes;
integrity_check=ok. This is not full transition/gameplay coverage. Interactive
settings, keyboard/modals, first-use/populated/recovery and game feedback still
need fresh post-change review and representative runtime journeys.
