# Audit map — certify-provenance-parity

| Item | Evidence |
|---|---|
| Certify provenance | `scripts/certification/certify-clean-checkout.mjs` `validate-provenance.mjs --check` no env |
| Default base | `scripts/validate-provenance.mjs` `origin/main` |
| CI real base | `.github/workflows/app-ci.yml` provenance step |
| V5 unused skip | 028 `validator-ci-hardening` spec vs `findStaleEntries` |
