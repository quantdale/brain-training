# Execution — Campaign 048 Startup, Performance, Resource & Reliability Soak

**Status:** ACTIVE  
**Mode:** day (repository default)  
**Start SHA:** `f8ef2fa`

Measure bounded representative cold/warm/force-stop/offline and route startup
behavior on the release artifact, combine it with the existing performance
probes and structured runtime markers, and inspect app-only logs. Do not make
an optimization change without a current measured regression and a scoped
repair.
