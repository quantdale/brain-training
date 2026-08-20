# Deferred Decisions Register

These are intentionally unresolved. Their absence is not permission for an agent to invent a permanent product decision during unrelated work.

## Deferred implementation seams (classified, task 10.4)

- Production audio/haptics feedback service: **implemented** (Wave
  `parallel-wave-01/06-sensory-feedback`). The `AudioHapticsService` SDK seam
  now has a real `expo-audio` + `expo-haptics` engine (`createAudioHaptics`),
  a canonical feedback-event vocabulary, deterministic no-op + recording
  test doubles, and dependency-free interfaces in `apps/mobile/src/sdk/
  audio-haptics.ts`. sfx + haptics toggles persist into the profile settings
  JSON; global/per-channel disable and asset lifecycle are handled. Music
  (BGM) remains **deferred**: the engine supports `musicEnabled` but no
  background-music control is exposed in the UI (a silent toggle would
  misrepresent reality). Theme selection IS persisted.

- Local data portability (backup/export/import + deletion): **implemented**
  (Wave `parallel-wave-01/05-data-portability` + convergence hardening). The
  engine provides a versioned, checksummed envelope, canonical JSON, integrity
  + future-version validation, preview/dry-run, merge/replace with dedupe and
  idempotency, atomic application + rollback, and a Data Management UI
  (`/data-management` linked from Profile) with export, import (merge/replace)
  and wipe (DELETE confirmation). No cloud/Supabase coupling; transport is
  UI-level JSON (file/share can be layered later).

## Product decisions deferred

- final app name and branding
- final public-release minimum OS versions
- exact account-provider implementation details
- Supabase production configuration/schema for cloud sync
- exact sync backend hosting/cost model
- exact free-tier daily usage mechanism
- paid version price/business model
- advertising provider/model
- whether normal gameplay currency can interact with AI inference economics
- exact AI assistant feature set
- exact RAG corpus/embedding/vector architecture
- AI inference provider(s) and credit pricing
- store publication/release strategy
- notification schedule and copy
- full accessibility release target
- tablet-specific UX
- social features, if ever revisited
- CDN/content delivery provider

When one becomes necessary, create an ADR or explicit product decision update before implementation.
