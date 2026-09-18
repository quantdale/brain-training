# Campaign 045 — Expo SDK57 Patch Alignment

## Problem

Expo Doctor reports a narrow SDK57 patch drift in five packages. The project
needs the smallest supported alignment, not broad dependency modernization.

## Outcome

Verify the drift, apply the supported Expo patch set if safe, keep package and
lockfile changes isolated, and rerun the strongest applicable repository,
build, launch, offline, and route checks.

## Non-goals

No major-version upgrade, unrelated dependency churn, architecture rewrite,
scoring/game change, CI masking, or speculative performance work.
