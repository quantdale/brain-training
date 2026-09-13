# Proposal — Certify provenance parity

## Why

Campaign 028 V6 required `certify-clean-checkout.mjs` to run the same gate **families** as CI so certification cannot overstate confidence. App CI / Android / iOS smoke resolve a real pre-change SHA (`github.event.before` / PR base / `HEAD^`) because `origin/main == HEAD` after a push makes `git diff` empty. Certify still runs `validate-provenance.mjs --check` **without** `PROVENANCE_BASE_REF`, so on a clean `main` checkout the gate logs "No changed files detected" and passes. 028 V5 also required allowlist entries that match no current skip to be reported; `findStaleEntries` only checks file existence and `enableWith` substring.

## What Changes

- Clean-checkout provenance MUST use a non-tautological base (same resolution policy as CI, or fail closed if no prior commit exists).
- Jest-skip allowlist validation MUST fail when an entry matches zero current pending tests (not only missing file / missing token).
- Document remaining intentional certify vs CI differences (`npm ci --ignore-scripts`, no native assemble).
- Self-tests / negative fixtures MUST prove a synthetic generator edit vs `HEAD` (or equivalent) is detected by the certify provenance invocation.

## Capabilities

### New Capabilities

- `certify-gate-honesty`: clean-checkout provenance and skip-allowlist staleness match the written 028 V5/V6 policy, not merely the gate-family list.

### Modified Capabilities

- (none in main `openspec/specs/`; tightens 028 `validator-ci-hardening` V5/V6)

## Impact

- `scripts/certification/certify-clean-checkout.mjs`
- `scripts/validate-provenance.mjs` (default base / env)
- `scripts/certification/validate-jest-signal.mjs`
- `scripts/qa/README.md` / certification docs
- Self-tests for both validators

## Out of scope

- Unifying `npm ci --ignore-scripts` with CI (record as documented exception unless a cheap fix exists)
- Enforcing `task-ownership.json` `prohibitedSurfaces` (separate dead field; MAY fix if in the same script pass)
- Emulator canaries

## Evidence

- `certify-clean-checkout.mjs` line running provenance without `PROVENANCE_BASE_REF`
- `validate-provenance.mjs` `baseRef = process.env.PROVENANCE_BASE_REF || 'origin/main'`
- App CI provenance step comments explaining why `origin/main` is wrong on push
- `findStaleEntries` implementation vs V5 sentence "entries that match no current skip MUST be reported"

## Dependencies

None.

## Intended outcome

A clean checkout of `main` cannot obtain a green provenance verdict that did no diff work; unused skip-allowlist rows fail closed.
