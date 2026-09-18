# Execution — Campaign 047 Persistence, Migration, Backup/Restore & Corruption Resilience

**Status:** ACTIVE  
**Mode:** day (repository default)  
**Start SHA:** `af1baaa`

Adversarially re-test the durable-state boundary after the Campaign 042 SQLite
serialization repair. Use repository fixtures/tests for historical migrations,
invalid input, rollback, idempotency, and duplicate imports. Use only disposable
state for destructive device cases, and do not apply replace import when a
non-destructive preview is sufficient.
