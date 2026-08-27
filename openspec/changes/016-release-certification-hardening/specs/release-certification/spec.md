# Release Certification Requirements

## Requirement RC-1 — Exact-state truth
The repository SHALL expose one unambiguous active campaign and SHALL NOT contain a terminal COMPLETED checkpoint whose corresponding machine-readable lifecycle remains ACTIVE without an explicit transition reason.

## Requirement RC-2 — Clean-checkout reproducibility
A fresh checkout SHALL install and pass all required repository/app gates without inherited caches, untracked generated state, or legacy install flags.

## Requirement RC-3 — Native build smoke
The release-candidate SHA SHALL demonstrate clean Android native generation/build and iOS simulator compile compatibility where infrastructure is available.

## Requirement RC-4 — Exact-SHA CI
Final certification SHALL cite successful App CI and Repository Integrity runs for the exact final SHA.

## Requirement RC-5 — Scope discipline
Constitution-deferred systems SHALL NOT be implemented merely to satisfy a generic notion of completion.
