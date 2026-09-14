## 1. Provenance base

- [x] 1.1 In `certify-clean-checkout.mjs`, set `PROVENANCE_BASE_REF` to a non-HEAD ref (`HEAD^` when `origin/main == HEAD`); fail closed if unresolvable.
- [x] 1.2 Add a self-test or documented command that a synthetic `generator.ts` edit vs that base exits 1.

## 2. Jest-skip orphans

- [x] 2.1 `validate-jest-signal.mjs`: allowlist entries matching zero pending tests fail closed.
- [x] 2.2 Extend `--self-test` with an orphan-entry fixture.

## 3. Docs

- [x] 3.1 Certification README: provenance base required; `npm ci --ignore-scripts` and no native assemble remain explicit exceptions.

## 4. Verification

- [x] 4.1 Validator self-tests PASS; `certify-clean-checkout` provenance step no longer prints "No changed files detected" solely from `origin/main == HEAD` on a dirty-free main checkout of a repo with history.
