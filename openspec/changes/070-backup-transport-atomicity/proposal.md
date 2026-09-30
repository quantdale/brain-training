# Change 070 — Backup Transport Durability and Import Robustness

## Why

The backup overwrite path is documented as atomic and is not. `createFileBackupTransport`
writes a temporary file and then calls `move(..., { overwrite: true })` with the
comment that "a same-directory rename is atomic on the app's private filesystem"
and "a failed write therefore leaves the previous complete backup available for
recovery". On Android, `expo-file-system` implements that overwrite as a
**delete-then-rename**: `prepareAsDestination` calls `it.deleteRecursively()` on
the existing destination *before* `tryNativeMove` attempts the rename. If the
process dies — power loss, ANR kill, force-stop — between those two steps, the
previous backup is gone and only a dotfile temp remains, which the listing
deliberately hides. The user's most recent backup is destroyed by a crash during
the write that was supposed to protect it.

The import side has a second class of problem: validation accumulates one
string per invalid entry with no cap, so a size-legal hostile backup is
amplified into a multi-hundred-megabyte error message; and the size cap bounds
*characters*, not the memory the pipeline needs, because the import path
materializes several full-size copies of the payload.

Smaller confirmed defects in the same module: a user-typed backup name
beginning with `.` or ending in `.tmp` is written and reported as saved but is
hidden from the listing, making it unrestorable and undeletable from the UI; and
a backup from a newer schema imports silently, dropping unknown fields with no
signal to the user.

## What Changes

- Make backup overwrite genuinely crash-safe: write to a temp file, keep the
  previous backup until the replacement is durably in place, and never leave the
  destination absent at any point where the process can be killed.
- Bound the aggregate size of validation diagnostics so a hostile or corrupt
  backup cannot be amplified into an out-of-memory condition, and report a
  summary of the remaining problems rather than an unbounded list.
- Reject backup names the listing would hide, before the file is written, with a
  message the user can act on.
- Surface a visible signal when an imported backup contains fields this version
  does not understand, so silent data loss is not possible.
- Correct the durability claims in the transport's own documentation and in the
  recorded deferred decision.

## Capabilities

### New Capabilities

- `backup-transport-durability`: the observable guarantees for writing, listing,
  reading, and replacing a backup file, including behavior under process
  termination and with hostile or oversized input.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/data-portability/file-transport.ts` — write/replace ordering,
  name validation, durable flush where the platform exposes it.
- `apps/mobile/src/data-portability/validate.ts` (diagnostic accumulation bound).
- `apps/mobile/src/data-portability/apply.ts` / `preview.ts` (forward-compat
  signal, where unknown fields are currently dropped).
- `apps/mobile/src/data-portability/deserialize.ts` (bound enforcement).
- `.agent/BACKLOG.md`, `.agent/KNOWN_ISSUES.md`, `docs/DEFERRED_DECISIONS.md` —
  the recorded "rename durability" deferral is narrower than the actual defect.
- No schema change; no data migration; no change to a successful backup's bytes.
