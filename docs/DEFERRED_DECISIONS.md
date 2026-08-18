# Deferred Decisions Register

These are intentionally unresolved. Their absence is not permission for an agent to invent a permanent product decision during unrelated work.

## Deferred implementation seams (classified, task 10.4)

- Production audio/haptics feedback service: currently a documented no-op
  (`noopAudioHaptics`). The sfx/music/haptics settings toggles are in-memory
  user preferences only — they do not yet drive real sound/vibration and are
  not persisted across restart (theme selection IS persisted). UI and parity
  matrix reflect this; the seam is intentionally deferred, not presented as
  functional completion.

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
