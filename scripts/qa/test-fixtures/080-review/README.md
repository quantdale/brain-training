# Campaign 080 review fixtures (P1-3)

Copied from the second independent review's scratch fixtures
(`brain-training-review/review-scratch/fixtures/`, produced by
`review-scratch/adversarial-probes.mjs`) and adapted for use as
`merge-coverage.mjs` ledgers with the MINIMUM necessary edits:

- `cross-build.png` / `cross-build.xml` — byte-identical copies (SHA-256
  `a4bcd7b8…` / `39bf18a4…` unchanged).
- `valid-artifact-ledger.json` / `missing-artifact-ledger.json` /
  `hash-mismatch-ledger.json` — the reviewer's `valid-artifact.json` /
  `missing-artifact.json` / `hash-mismatch.json` run records with:
  1. a `schemaVersion: 2` wrapper (the merger requires it; the reviewer's
     originals were verifier-only fixtures);
  2. `gameId` changed from `made-up-game` to the registered
     `memory-pair-recall`, so artifact attestation is the ONLY failing
     dimension under test;
  3. `evidenceArtifact.file` rewritten from `review-scratch/fixtures/…` to
     `scripts/qa/test-fixtures/080-review/…` (the files live here now).

Everything else (attempt id `cli-valid`, observation phases `launch` /
`terminal`, recorded digests, byte counts, artifact kinds, the deliberate
missing file `does-not-exist.png` and the deliberate `f…f` digest in the
hash-mismatch fixture) is preserved verbatim.

Expected attestation outcomes (merge-coverage.mjs, local mode):

| fixture | artifact bytes | attestation |
|---|---|---|
| `valid-artifact-ledger.json` | present, hashes match | CERTIFYING |
| `missing-artifact-ledger.json` | `does-not-exist.png` absent | NON_CERTIFYING (unreadable) |
| `hash-mismatch-ledger.json` | digest `f…f` contradicts bytes | NON_CERTIFYING (mismatch) |
