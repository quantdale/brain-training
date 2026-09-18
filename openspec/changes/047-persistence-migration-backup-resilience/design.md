# Design — Campaign 047

Use the existing migration and data-portability test fixtures as the primary
adversarial lane. Use the dedicated `emulator-5554` for a fresh-v12 database,
relaunch checks, and a real Data Management export/load flow. Keep the current
catalog database as a recovery source; destructive Replace Import remains a
preview-only action unless an isolated disposable database is created.

Record exact row counts and SQLite checks before and after each import-related
operation. Treat session IDs, currency operation IDs, rating natural keys,
workout identity, and version metadata as the durable invariants. If a check
cannot be executed safely, record `NOT VALIDATED` rather than inferring green.
