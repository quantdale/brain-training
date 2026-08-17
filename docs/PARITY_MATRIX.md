# Product Parity Matrix

**Purpose:** durable inventory of product capabilities to eventually match or surpass through original implementation. This is feature/mechanic parity, not direct cloning.

Legend: `DEFERRED`, `PLANNED`, `FOUNDATION`, `IMPLEMENTED`, `HARDENED`, `RETIRED`.

| Area | Capability | Status | Notes |
|---|---|---:|---|
| Core | Offline-first gameplay | IMPLEMENTED | Offline-boundary suite + `scripts/validate-offline.mjs` (223 files clean) |
| Core | Optional account | DEFERRED | Local profile first |
| Core | Cross-device sync | DEFERRED | Local-first future Supabase direction |
| Training | Daily Workout | IMPLEMENTED | Deterministic 4-game daily + rerolls |
| Training | Adaptive difficulty | IMPLEMENTED | Hidden continuous rating + named modes |
| Training | Manual difficulty | IMPLEMENTED | Easy/Normal/Hard/Expert/Adaptive |
| Training | Personalized recommendations | IMPLEMENTED | Weak-domain balancing + recency avoidance + reroll economics |
| Games | Memory catalog | IMPLEMENTED | Memory (Phase 2) + Sequence Memory (Phase 4) + Pattern Tap Back (Phase 5) — 3 games |
| Games | Attention catalog | IMPLEMENTED | Visual Search (Phase 2) + Odd One Out (Phase 4) — 2 games |
| Games | Speed catalog | IMPLEMENTED | Reaction Time (Phase 2) + Tap Rush (Phase 4) + Color Match (Phase 5) — 3 games |
| Games | Math catalog | IMPLEMENTED | Fast Math (Phase 2) + Missing Operator (Phase 4) + Equation Builder (Phase 5) — 3 games |
| Games | Language catalog | IMPLEMENTED | Word Match (Phase 2) + Word Scramble (Phase 4) + Sentence Builder (Phase 5) + versioned content packs — 3 games |
| Games | Logic & Problem Solving catalog | IMPLEMENTED | Next in Sequence (Phase 2) + Code Cracker (Phase 4) — 2 games |
| Games | Flexibility catalog | IMPLEMENTED | Card Sort (Phase 2) + Color Stroop (Phase 4) — 2 games |
| Games | Spatial catalog | IMPLEMENTED | Mental Rotation (Phase 2) + Transform Match (Phase 4) — 2 games |
| Progress | Overall performance score | PLANNED | Transparent composite |
| Progress | Domain ratings | IMPLEMENTED | Stale-marked, no decay; history in `/progress-detail` |
| Progress | Per-game analytics/records | IMPLEMENTED | `/progress-detail` records + aggregates |
| Progression | XP/global player level | IMPLEMENTED | 50·L·(L−1) curve; sessions + awards compose lifetime XP |
| Progression | Achievements | IMPLEMENTED | 4 long-term, once-only unlock/claim (foundations) |
| Progression | Daily/weekly quests | IMPLEMENTED | Live evaluation + claims (foundations) |
| Progression | Earnable currency | IMPLEMENTED | Append-only ledger; spend paths (rerolls, streak items) |
| Progression | Streak freeze/recovery | IMPLEMENTED | Costs/limits + inventory + purchase UI (foundations) |
| Progression | Cosmetics/themes | FOUNDATION | Registry seam + persisted system/light/dark selection |
| UX | Favorites | IMPLEMENTED | Library quick access + filters |
| UX | Search/filter | IMPLEMENTED | Required for large catalog |
| UX | Interactive tutorials | IMPLEMENTED | Replayable, QA bypass |
| UX | Audio/haptics | IMPLEMENTED | Muteable via settings toggles (in-memory) |
| Content | Deterministic procedural generation | IMPLEMENTED | Seeded per game, versioned |
| Content | Curated versioned packs | IMPLEMENTED | Language pack + pack registry seam |
| Data | Manual backup/export/import | DEFERRED | Preserve seams now |
| Data | Full deletion | DEFERRED | Backend portion deferred |
| AI | AI assistant/RAG | DEFERRED | Advisory only by default |
| AI | AI-generated validated challenges | DEFERRED | Never unvalidated scoring content |
| Social | Leaderboards/friends/leagues | DEFERRED | Explicitly out of current scope |
| Commercial | Entitlements abstraction | PLANNED | Lightweight seam only |
| Commercial | Paid/free tiers | DEFERRED | Model not finalized |
| Commercial | Ads | DEFERRED | Possible future option |
| Commercial | AI credits | DEFERRED | Separate from normal currency |
| Platform | Android autonomous QA | IMPLEMENTED | AVD `braintraining35` + adb/uiautomator automation |
| Platform | iOS compatibility | PLANNED | Static audit PASS 2026-08-17; real build blocked on Windows host |
| Platform | iOS autonomous QA | DEFERRED | Later |
