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
  - future-version validation, preview/dry-run, merge/replace with dedupe and
  idempotency, atomic application + rollback, and a Data Management UI
  (`/data-management` linked from Profile) with export, import (merge/replace)
  and wipe (DELETE confirmation). No cloud/Supabase coupling; transport is
  native local file export/import (`expo-document-picker` + `expo-sharing` /
  `expo-file-system`) backed by the page's copy-to-clipboard affordance — no
  network path.
- Password-encrypted backups: **deferred** (constitution §7 says "eventually";
  §33 never listed them, and Campaign 028 recorded that gap explicitly).
  Backups are a plaintext checksummed JSON envelope and the checksum is
  integrity-only (not a MAC). Encrypting backups is a product/security
  decision — passphrase UX, KDF parameters, format/versioning, recovery
  semantics — and must not be invented during unrelated work; revisit only
  with an owner-authorized decision.
- Backup physical durability (fsync): **still deferred** (Change 070,
  2026-09-30). Recorded here so the deferral is not re-derived as "backup
  durability is handled". It is only *partly* handled: Change 070 closed the
  ORDERING window — the installed `expo-file-system` Android move is a
  delete-then-rename, so the previous single `move(temp, dest, { overwrite:
  true })` could leave the user with no backup at that name and no indication of
  the loss. Replacement now rotates through a `.prev` sibling and verifies the
  new content before discarding the old one, so at least one complete readable
  copy exists at every instant. The **PHYSICAL** window — bytes written but not
  yet on storage, which needs an fsync the dependency does not expose — remains
  open, bounded by the rotation: a power loss can lose the newest backup's tail
  while the previous complete backup survives to the next boot. Owner:
  release-engineering orchestrator.

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
