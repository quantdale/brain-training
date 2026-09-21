# Post-067 hardening — Pass A (static / architecture / contracts / security)

**Method:** independent read-only critic against the certified tree,
starting from the 066 Pass A census and probing beyond it; every accepted
finding reproduced before a fix.

## Fixed

| Finding | Severity | Fix | Proof |
|---|---|---|---|
| Repo-state gate rejected the hardening phase state (validator condition still required `ACTIVE`) | High (governance) | allowed states `ACTIVE`/`PHASE_2_HARDENING`/`COMPLETE`; non-ACTIVE requires the current change `VALIDATED` (067 closed in the same wave) | `node scripts/validate-repo-state.mjs` PASS; governance test `repo-state.test.ts` |
| Imported `workoutInstances[].gameIds` had no upper bound → persisted unbounded array → Home renders one row per leg (DoS/OOM; ~1 MB crafted backup, checksum recomputed) | Medium | reject `> MAX_WORKOUT_GAME_IDS` (6) in `validateData` with a typed error | deserialize test: 7 rejected, 4/6 accepted |
| Generator accepted `generatorVersion: ""` / missing `description` while the runtime SDK rejects them at bootstrap | Low (contract drift) | generator mirrors the SDK checks + `--self-check` fixtures | generator self-check + `registry-generator.test.ts`; `--check` green |
| `canonicalize` assigned parsed keys directly (`__proto__` pollution footgun; exported API) | Low | `Object.defineProperty` assignment; `__proto__` own-key test | canonical tests |
| Deeply nested backup threw `RangeError` outside the typed error contract | Low | canonicalization failures wrapped into the typed malformed-backup error | 100k-nesting test |
| `listBackups()` could list leftover dotfiles/`.tmp` partials | Low | filter dotfiles + `.tmp` | transport test |
| Export retained one string per JSON token (~3.5M chunks, ~305 MB heap at 20k sessions) | Medium | token coalescing at 16 KB in the canonical writer; byte-parity preserved | byte-parity suites + 20k `LARGE_BACKUP_PROBE` pass |

## Verified accepted (not silently worse)

- **Checksum is integrity-only, not a MAC** (`docs/DEFERRED_DECISIONS.md`) —
  a hand-edited backup can be re-checksummed; owner product decision,
  unchanged.
- **`allowBackup=true` carries the plaintext backups folder** under the
  files domain (only `database` is excluded). Recorded in BACKLOG and
  disclosed in the UI; fixing is an owner decision.
- **Unauthenticated `braintraining://` scheme** — parameters bounded by
  the route envelope; accepted boundary.
- **ReDoS `decode-uri-component`** — accepted debt to 2027-03-31, gate
  wired, re-evaluate at the next Expo SDK upgrade.
- **QA force controls** are `__DEV__`-gated; perf instrumentation no-ops
  in release (verified in source).

## Checked clean

Deep-link envelope bounds; backup filename/path traversal; persisted
`JSON.parse` degradation; NaN/overflow math (safe-integer gates);
logcat content; clipboard (unused); generated-artifact `--check`;
secrets/dependency/workflow/offline/provenance/task-ownership gates.

## Not reproduced

Forged `criteria_json` crash; prototype pollution via import paths;
filename traversal; `Math.random` identity concerns; additional layer
violations beyond the known accepted ones; NaN propagation from imported
raw results.
