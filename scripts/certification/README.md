# Certification gates

`certify-clean-checkout.mjs` runs the release-confidence gate set against a
fresh checkout (no inherited `node_modules`, native folders or Expo state) so a
green verdict cannot depend on a warmed working tree.

```sh
node scripts/certification/certify-clean-checkout.mjs            # full gate
node scripts/certification/certify-clean-checkout.mjs --self-test # offline policy test
```

## Gate set

Repository state, task ownership, OpenSpec, generated registry, **provenance**,
offline boundary, secrets boundary, workflow hygiene, dependency audit,
affected-area map sync, the offline ARTEMIS runtime-QA contract, validator self-tests, typecheck,
lint, web export, Expo Doctor, full Jest (machine-readable summary validated
against the intentional-skip allowlist), and a tracked/generated-mutation
check.

## Provenance base is required and non-tautological

`validate-provenance.mjs` defaults to `origin/main`. Immediately after a push
that ref **is** `HEAD`, so `git diff` is empty and the gate would pass without
doing any work (the 028 V6 failure class). Certify therefore resolves its own
base before invoking the validator:

1. an explicit `PROVENANCE_BASE_REF` (already resolvable) wins;
2. else `origin/main` when it differs from `HEAD`;
3. else `HEAD^`;
4. else it **fails closed** — an orphan history has no pre-change tree to diff.

This mirrors the App CI policy (`github.event.before` / PR base). A synthetic
unversioned `generator.ts` edit fails the gate by design; the provenance
self-test pins that fixture (`node scripts/validate-provenance.mjs --self-test`).

## Intentional differences from CI (documented exceptions)

Certify is a confidence gate, not a full CI replica. These differences are
deliberate and must not be read as CI parity:

- **`npm ci --ignore-scripts`**: certify skips lifecycle scripts so the gate
  cannot execute arbitrary package scripts on the certification host. CI keeps
  its normal install behavior.
- **No native assemble**: certify does not build/assemble Android or iOS
  artifacts. Native compilation is covered by `android-build-smoke.yml` and
  `ios-build-smoke.yml` (and a real device/emulator for runtime evidence).
- **Emulator tasks are out of scope**: runtime journeys come from the external
  ARTEMIS checkout on a dedicated emulator, not from this clean-checkout gate.

## Jest skip allowlist

`validate-jest-signal.mjs` classifies every pending/skipped Jest assertion
against `jest-skip-allowlist.json` (**schema v4**). Each entry carries review
metadata (`reviewedAt`, `expires`), the `enableWith` gate that re-activates the
skipped probe, and `expectedMatches` — the reviewed number of pending tests the
entry may match in one run. The validator fails closed when:

- a skip matches no entry (unclassified) or more than one entry (ambiguous);
- an entry's matched pending count differs from its `expectedMatches` pin — so
  a new `it.skip` whose name merely contains an allowlisted pattern cannot be
  absorbed by an entry reviewed for a different test;
- an entry's file is missing or its `enableWith` gate disappeared (stale);
- an entry matched zero pending tests (orphan exemption);
- an entry's `expires` date has passed (near-expiry entries warn 60 days out);
- the run summary falls below the reviewed top-level `minTotalSuites` /
  `minTotalTests` floors (intentional reductions require review).

The machine-readable report contains only counters the Jest summary can
actually populate; the always-zero warning fields were dropped in schema v4.
Self-test: `node scripts/certification/validate-jest-signal.mjs --self-test`.
