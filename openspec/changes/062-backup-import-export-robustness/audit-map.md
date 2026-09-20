# Audit map — 062-backup-import-export-robustness

**Program SHA:** `428d293` · **Predecessor:** `061-performance-lifecycle-cleanup` (VALIDATED)

## Evidence chain

1. Picker stat fallback → `file-transport.ts` (asset-size gate first,
   then copied-file stat, defensive) · mock `size` getter · tests:
   size-absent hostile (zero `text()` reads), size-absent normal,
   asset-size paths untouched.
2. Paste guard → `data-management.tsx` (both handlers + native
   `maxLength`) · tests: preview refusal (no `previewImport` call),
   import refusal (no apply), maxLength prop, honest header copy.
   Debugging note: the screen reads the cap through the suite-mocked
   barrel — the mock re-exports the real constant so guards are tested,
   not mocked away.
3. Copy + backlog → header disclosure; test updated; BACKLOG product
   decision (cloud exclusion requires owner direction).
4. Focused suites green; typecheck; lint; OpenSpec strict.

## Census claims closed by design evidence (no change)

- Plaintext backups (constitution-deferred encryption).
- Cloud exclusion config (owner product decision — BACKLOG).
- Filename tightening (would orphan legacy files; traversal blocked).
- Tmp nonce (sandboxed private dir; unpredictability buys nothing).
- Listing filter (would hide user data; orphans deletable).
- Export lock, import validation (proven paths).

## Residuals

- Providers with neither size signal fall back to the text/deserialize
  gates (pre-existing behavior, unchanged). A present-but-untruthful
  (e.g. zero) stat likewise fails open to those gates — no regression,
  documented (adversarial F1).
- Bytes-vs-chars: the byte gates reject a strict superset (conservative
  direction). A chars-valid/bytes-over backup can still import via paste
  (char-counted) or the internal Load path (ungated `readBackup`); the
  mock size is char length for ASCII fixtures (F2/F3).
- Native `maxLength` truncates silent pastes to exactly the cap, so the
  JS guard message is reachable only via programmatic loads (e.g.
  oversized saved backups through Load), not manual typing (F4).
- Device SAF/provider quirks: unit-pinned seam only; re-proven at 067.
- Equal-to-cap pastes still preview (deserialize `>` semantics).

## Boundaries

Manual/platform/store/CI per program. No layout/route change beyond
copy; no schema/economy change.
