# Proposal — ARTEMIS runtime-QA migration

## Why

The repository's custom Android Autobot has become the wrong runtime boundary
for this product. The owner has directed that Google ARTEMIS be the primary
Android runtime/device-QA controller used by Codex, with the upstream checkout
kept outside the product repository at `D:\Tools\artemis`.

The migration must remove the obsolete gameplay driver and its repository
integration without removing the app's semantic IDs, accessibility labels,
deep links, deterministic fixtures, versioned game/scoring metadata, or
structured diagnostics. Those seams make the app observable to ARTEMIS and
remain part of the product QA contract.

## In scope

- Reconcile a clean upstream ARTEMIS checkout, its Python environment, doctor
  checks, ADB/device readiness, and the bundled accessibility helper.
- Keep provider credentials only in the external ARTEMIS environment; never
  expose a credential in repository files, Codex configuration, logs, traces,
  screenshots, or agent messages.
- Use ARTEMIS Flash/Pro runtime tasks and trace inspection as the Android
  evidence path. Classify unavailable model/provider/device evidence honestly.
- Install only the ARTEMIS MCP server block through its supported Codex
  generator/merge path. Do not run the broad `mcp --install all` bootstrap.
- Remove the custom driver, lockfile integration, obsolete CI/certification
  invocations, and current documentation that presents it as authoritative.
- Keep repository-side Android scripts for AVD provisioning, APK install/reset,
  hierarchy/screenshot/logcat capture, and diagnostics.
- Add an offline repository contract and update governance/durable state,
  validation records, and migration documentation.
- Rebuild/install the current app and run deterministic repository checks.

## Out of scope

- New games, product features, scoring/persistence changes, or UX redesign.
- Vendoring or copying ARTEMIS into Git.
- Multiple emulators, host mouse/keyboard automation, desktop focus control,
  or a second gameplay driver.
- Global MCP/rules installation, secrets rotation, paid provider setup, or
  irreversible external publication.
- Full hardening beyond this migration.

## Completion shape

The repository is complete when the ARTEMIS boundary is encoded and validated,
the current app remains buildable/startable, MCP configuration is merged
without unrelated Codex settings being lost, deterministic gates are green,
and every unavailable live task is recorded as `BLOCKED` or `NOT VALIDATED`
with its non-secret evidence. Live Brain Training Flash and Pro evidence may
remain open only under the documented external provider blocker.
