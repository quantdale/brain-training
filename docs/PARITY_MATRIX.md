# Product Parity Matrix

**Purpose:** durable inventory of product capabilities to eventually match or surpass through original implementation. This is feature/mechanic parity, not direct cloning.

Legend: `DEFERRED`, `PLANNED`, `FOUNDATION`, `IMPLEMENTED`, `HARDENED`, `RETIRED`.

| Area | Capability | Status | Notes |
| --- | --- | ---: | --- |
| Core | Offline-first gameplay | IMPLEMENTED | Offline-boundary suite + `scripts/validate-offline.mjs` (768 files clean) |
| Core | Optional account | DEFERRED | Local profile first |
| Core | Cross-device sync | DEFERRED | Local-first future Supabase direction |
| Training | Daily Workout | IMPLEMENTED | Deterministic 4-game daily + rerolls |
| Training | Adaptive difficulty | IMPLEMENTED | Hidden continuous rating + named modes |
| Training | Manual difficulty | IMPLEMENTED | Easy/Normal/Hard/Expert/Adaptive |
| Training | Personalized recommendations | IMPLEMENTED | Weak-domain balancing + recency avoidance + reroll economics |
| Games | Memory catalog | IMPLEMENTED | Memory (Phase 2) + Sequence Memory (Phase 4) + Pattern Tap Back (Phase 5) + Grid Recall + Running Order (Wave 02) — 5 games |
| Games | Attention catalog | IMPLEMENTED | Visual Search (Phase 2) + Odd One Out (Phase 4) + Target Count (Wave 01) + Symbol Tracker (Wave 02) — 4 games |
| Games | Speed catalog | IMPLEMENTED | Reaction Time (Phase 2) + Tap Rush (Phase 4) + Color Match (Phase 5) + Quick Compare (Wave 02) — 4 games |
| Games | Math catalog | IMPLEMENTED | Fast Math (Phase 2) + Missing Operator (Phase 4) + Equation Builder (Phase 5) — 3 games |
| Games | Language catalog | IMPLEMENTED | Word Match (Phase 2) + Word Scramble (Phase 4) + Sentence Builder (Phase 5) + Context Fit + Word Chain (Wave 02) + versioned content packs — 5 games |
| Games | Logic & Problem Solving catalog | IMPLEMENTED | Next in Sequence (Phase 2) + Code Cracker (Phase 4) + Rule Grid (Wave 01) + Deduction Table + Order Path (Wave 02) — 5 games |
| Games | Flexibility catalog | IMPLEMENTED | Card Sort (Phase 2) + Color Stroop (Phase 4) + Cue Shift (Wave 01) + Rule Flip + Task Switch (Wave 02) — 5 games |
| Games | Spatial catalog | IMPLEMENTED | Mental Rotation (Phase 2) + Transform Match (Phase 4) + Grid Navigator (Wave 01) + Coordinate Turn + Fold Match (Wave 02) — 5 games |
| Progress | Overall performance score | IMPLEMENTED | Transparent composite via `analytics/composite-explainer` (canonical rating logic, freshness-weighted) |
| Progress | Domain ratings | IMPLEMENTED | Stale-marked, no decay; 7d/30d/90d/all windows + activity calendar in Progress |
| Progress | Per-game analytics/records | IMPLEMENTED | Per-game drill-down (`/progress-game`) with score/accuracy/reaction trends, personal records, recent vs lifetime |
| Progression | XP/global player level | IMPLEMENTED | 50·L·(L−1) curve; sessions + awards compose lifetime XP |
| Progression | Achievements | IMPLEMENTED | Expanded catalog (milestone/volume/streak/perfect + Wave 02: depth/breadth/consistency/accuracy/personal-best/workout-completion families, aggregation snapshot builders) with progress, claim, celebration |
| Progression | Daily/weekly quests | IMPLEMENTED | Deterministic daily/weekly pool (3+3 active) with progress + claim UX, celebration |
| Progression | Earnable currency | IMPLEMENTED | Append-only ledger; spend paths (rerolls, streak items, cosmetics) — atomic/idempotent, no pay-to-win |
| Progression | Streak freeze/recovery | IMPLEMENTED | Costs/limits + inventory + transactional atomic apply/claim + milestones + celebration |
| Progression | Cosmetics/themes | IMPLEMENTED | Expanded registry (avatar frames/accents/celebrations) with earn/unlock/equip + persisted equipped state + `/rewards` hub |
| UX | Favorites | IMPLEMENTED | Library quick access + filters |
| UX | Search/filter | IMPLEMENTED | Required for large catalog |
| UX | Interactive tutorials | IMPLEMENTED | Replayable, QA bypass |
| UX | Audio/haptics | IMPLEMENTED | Real `expo-audio` + `expo-haptics` engine behind the `AudioHapticsService` SDK seam; canonical feedback events (tap/correct/wrong/success/failure/record/reward); sfx + haptics toggles persist into profile settings JSON; global off + per-channel disable; assets preloaded/released. Music remains DEFERRED (no BGM control exposed). Theme selection IS persisted. See `docs/DEFERRED_DECISIONS.md`. |
| Content | Deterministic procedural generation | IMPLEMENTED | Seeded per game, versioned |
| Content | Curated versioned packs | IMPLEMENTED | Language pack + pack registry seam |
| Data | Manual backup/export/import | IMPLEMENTED | Versioned, checksummed envelope; preview/dry-run; merge/replace with dedupe/idempotency; integrity/future-version rejection; atomic + rollback |
| Data | Full deletion | IMPLEMENTED | Local deletion workflow with counts + DELETE confirmation; append-only triggers remain valid |
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
