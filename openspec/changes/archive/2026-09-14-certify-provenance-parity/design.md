## Context

`validate-provenance.mjs` defaults `PROVENANCE_BASE_REF || 'origin/main'`. After push, that diff is empty. App CI sets a real base. Certify does not. V5 unused-skip clause is unimplemented.

## Goals / Non-Goals

**Goals:** certify provenance does real work; orphan skip-allowlist rows fail; document remaining exceptions.

**Non-Goals:** changing App CI; native assemble inside certify; `npm ci` lifecycle unification (document only).

## Decisions

1. **Certify sets `PROVENANCE_BASE_REF`.** Resolve `HEAD^` when on `main` and `origin/main` resolves to HEAD; if `HEAD^` is missing (orphan commit), fail closed with a clear BLOCKED message rather than PASS.
2. **Keep `--check` fail-closed.** Do not change the non-`--check` always-0 behavior in this change unless a one-line default to `--check` is agreed; document it.
3. **Jest signal:** after classifying pending tests, any allowlist entry with zero matches is stale (schema v2). Fixture: file contains `PERF_PROBE` in a comment, summary has no skip → fail.
4. **README table:** CI vs certify columns including provenance base, ignore-scripts, no assemble.

## Risks / Trade-offs

- First commit of a repo cannot `HEAD^` — fail closed is honest.
- Weekly Integrity already uses live audit; this change does not touch it.

## Testing strategy

- Unit the base resolver: `origin/main == HEAD` → `HEAD^`.
- Negative: mutate a fixture generator path against that base → exit 1.
- Jest-signal self-test: orphan allowlist entry.
