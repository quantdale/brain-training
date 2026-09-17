# Campaign 039 — Performance, Reliability & Maintenance Isolation

## Problem

The redesigned product has accumulated performance probes, lazy route seams,
SQLite writes, and external dependency advisories, but current behavior must be
measured rather than inferred from historical notes or theoretical hotspots.

## Outcome

Establish current startup, route-transition, persistence/relaunch, and runtime
warning evidence on the dedicated Android target and repair only a demonstrated
material regression. Keep any dependency maintenance isolated from product
behavior and do not edit CI workflows to hide external failures.

## Non-goals

No major product feature, game-mechanics change, schema/migration change,
economy change, session/workout identity change, router rewrite, speculative
micro-optimization, or unsupported performance claim.

