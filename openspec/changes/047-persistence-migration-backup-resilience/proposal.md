# Campaign 047 — Persistence, Migration, Backup/Restore & Corruption Resilience

## Objective

Re-test durable state after the Campaign 042 database serialization repair and
the full-catalog session batch. Prove that fresh and existing v12 databases,
historical migrations, concurrent-looking writes, backup round trips, and
invalid input preserve integrity and identity.

## Scope

- fresh initialization and existing v12 database checks;
- supported migration fixtures through v12;
- force-stop/relaunch and settings/workout/result persistence;
- export/load and merge/replace preview behavior;
- duplicate replay, invalid/corrupt input, rollback, and idempotency;
- profile, favorites, tutorial, reward, rating, session, and workout identity.

## Non-goals

No schema redesign, product feature work, destructive import on the retained
catalog database, or speculative repair without a reproduced data-integrity
defect.
