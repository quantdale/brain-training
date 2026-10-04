# Change 076 Audit Map — Finding to Response

Sources: `evidence/README.md` + `evidence/before/index.json` (Explore-stage
release baseline: 20 device PNGs at source `d3d0b992…`, APK `d631ab9a…` on
`braintraining-ui35`), the proposal's on-device observations, and the
Refero research recorded in `design.md` (Playdate / Peloton / V–A–C styles;
Brilliant / Imprint / Duolingo screens; Imprint + Brilliant flows).

| Finding | Rank / class | Response | Implementation surface | Evidence |
| --- | --- | --- | --- | --- |
| A-01 Product reads as a collection of oversized, repeated panels, not one playable system (proposal Why; baseline Home/Progress/Profile) | High (cross-product) | Three-prototype selection gate, then one reference lock governing every destination; page-shell + section grammar shared, per-surface composition owned | theme tokens, `components/ui/*`, all routes | `evidence/` before/after matrices; visual decision report (task 14.7) |
| A-02 Home's decorative hero/workout block dominates the first viewport; at 2× text the first-run primary action falls below the fold (evidence README) | High | Action-led navigation: visible primary action in the first viewport at default and 2×; decorative stage demoted to compact art slot | `app/(tabs)/index.tsx`, workout components | matched Home before/after captures (4.1) |
| A-03 Games' recommended-game hero pushes library discovery downward; browse efficiency lost (evidence README) | High | Recommendation compacted; complete library grid + search/filters reachable in first viewport; honest empty/reset states | `app/(tabs)/games.tsx`, `components/discovery/*` | Games before/after + empty/search states (4.3) |
| A-04 Game intro pairs an oversized art stage with an instructional sheet; Start hard to see in the first viewport (evidence README) | High | Intro/tutorial rebuilt: instruction-first with reachable Start/Try-again; art right-sized; tutorial retry reachable at 2× (055 lesson) | `components/game-ui/tutorial-frame.tsx`, game-host intro chrome | intro before/after per domain (3.3) |
| A-05 Dark mode is a palette inversion of the same oversized composition (evidence README) | High | Dark is designed per-surface in the selected system, not inverted; dark captures part of every matched matrix | theme tokens + all surfaces | dark route/game matrices (14.3) |
| A-06 Baseline evidence gap: no active-game, feedback, result, compact or error captures existed before this change (evidence README "Missing before evidence") | High (evidence integrity) | Complete old-build baseline first: route states (1.3) and per-domain game states (1.4–1.12) captured against the preserved old APK before any module edit; unreachable states recorded NOT VALIDATED with cause | capture harness + `evidence/` | per-domain baseline manifests |
| A-07 42 game boards owned by 209 per-game component files cannot be fixed by shared style alone (proposal Impact) | High | Shallow shared visual contract + deep mechanic-owned boards; eight isolated domain packets; per-ID device review; no generic template reskin | `games/<domain>/*` per packet | 42/42 board review manifest (14.2) |
| A-08 Feedback/result states risk miscue when color alone carries meaning; red CTA vs error ambiguity in candidate B (design.md risk) | High | Accessible semantic feedback spec: text/shape/a11y semantics beyond color; error uses explicit icon/shape/text; contrast ≥4.5:1 normal / ≥3:1 large; 48dp/44pt targets | game-ui feedback + result chrome, tokens | a11y audit + contrast tests (3.1, 14.3) |
| A-09 ARTEMIS/MCP or iOS tooling may be unavailable (design.md risk) | Medium | Verify ARTEMIS doctor + supported MCP first (1.2); record precise BLOCKED condition if the lane fails; never improvise host-input automation; iOS reviewed independently where tooling exists, else NOT VALIDATED | runtime QA | `evidence/task-1-2-artemis.md`; 14.4/14.6 records |
| A-10 Evidence may leak personal data/credentials (design.md risk) | Medium | Deterministic local fixtures; audit images/metadata before Git; raw traces/provider config stay outside the repo; only scrubbed evidence committed | capture discipline | evidence READMEs per wave |
| A-11 Candidate directions may fail real play (legibility, adult trust, 2× type) even when screenshots look attractive (design.md risk) | High | Equal-journey on-device prototypes with weighted scorecard (30% playability, 25% accessibility, 20% first-viewport action clarity, 15% distinctiveness, 10% feasibility); blocking a11y/progress-loss defect disqualifies; no averaged blend | prototype surfaces (dev-only) | scorecard + reference lock (2.4–2.5) |
| A-12 Chrome changes could regress scoring/completion/persistence or a11y automation seams | High | Protected contracts pinned: SDK boundaries, test IDs, fixture controls retained; risk-based canaries + impact-map checks per wave; Critical/High regression stops expansion | all surfaces | per-wave validation records |

## Protected floor (not reopened)

- Phase 10 terminal certification residuals and the post-067 hardening floor:
  SQLite transactional integrity, workout CAS/provenance, portability,
  dependency allowlist, offline boundary, runtime-QA contract validators.
- Campaign 055's device-proven repairs (HUD wrap, single score row, tutorial
  retry reachability) must survive the reboot in the new system.
- No new gamification economy, new games, content/generator overhaul, cloud
  sync, or foundational animation/rendering dependency (design.md Non-Goals).
