# Task Packet 003-c — Content-Pack Registry + Storage Seam (WP-3C)

Campaign: 003-platform-integration
Status: DONE
Owner role: coder agent

## Objective

Build the content-pack versioning + storage-management seam (constitution §24) as a self-contained module under `apps/mobile/src/content/`. The language game already ships a pack at `apps/mobile/src/games/language-word-match/content/pack.json` with a validator at `content-validation.ts` — your registry is fed by that pack (and is designed to extend to future packs).

## Dependencies (read-only, all committed)

- `apps/mobile/src/games/language-word-match/content/pack.json` — schema: `{packId, packVersion, itemCount, families, items[]}`.
- `apps/mobile/src/games/language-word-match/content-validation.ts` — read it; reuse its validation if importable (check whether it exports a function; if it is a script, replicate its checks minimally in your registry test instead of importing).
- `apps/mobile/src/db/index.ts` — NOT required; this seam is pure/static for now. If you need a persistence seam, do NOT add one — the orchestrator decides storage later. Keep it in-memory + static registry.

## Required deliverables (all under `apps/mobile/src/content/`)

- `types.ts` — `PackInfo {packId:string, packVersion:string, itemCount:number, sizeEstimateBytes:number, sourceGameId:string, source:'bundled'}`, `StorageSummary {packs:PackInfo[], totalItems:number, totalSizeEstimateBytes:number}`.
- `registry.ts` — `getBundledPacks(): PackInfo[]` — statically enumerates known bundled packs (the language pack; read its `pack.json` directly via JSON import or a typed reader), validates required fields, computes `sizeEstimateBytes` deterministically (document the heuristic, e.g. sum of JSON string length of items × UTF-8 multiplier — must be deterministic across runs), and `getPack(packId): PackInfo | null`, `getStorageSummary(): StorageSummary`.
- `storage.ts` — storage-management scaffold with graceful no-op fallbacks:
  - `listInstalledPacks(): Promise<PackInfo[]>` — returns bundled packs (no-op persistence layer for now).
  - `clearPackCache(packId): Promise<{cleared:boolean, reason?:string}>` — always returns `{cleared:false, reason:'not-implemented'}` (documented seam; bundled packs are not clearable).
  - `estimatedPackSizeBytes(packId): Promise<number | null>`.
- `index.ts` — barrel with named exports.
- `__tests__/` — registry correctness vs the actual pack.json (ids/version/itemCount match, size estimate is deterministic and positive), unknown pack → null, storage no-ops return the documented shape, storage summary math.

## Conventions

- TypeScript strict; deterministic tests; no new dependencies; no network, no filesystem IO at runtime.
- Do NOT modify the language game module or its pack.

## Allowed write surfaces

- `apps/mobile/src/content/**`

## Forbidden / shared write surfaces

- `apps/mobile/src/db/**`, `src/sdk/**`, `src/app/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/registry/**`, `src/workout/**`, `src/quests/**`, `src/streaks/**`, `apps/mobile/src/games/**` (read-only), `package.json`, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- All own tests pass (`npx jest src/content` from `apps/mobile`).
- `npx tsc --noEmit` (from `apps/mobile`) — fix only errors in your ownership surface.
- Registry data matches the real pack.json exactly.

## Cheap validation

- `npx jest src/content` and `npx tsc --noEmit` (both from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator may later surface storage usage in Settings/Profile. The seam must be ready to extend with real on-disk packs without API churn.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
