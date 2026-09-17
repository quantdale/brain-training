# Progress information hierarchy

## Level 1: overview answers

The first populated card is `At a glance`, scoped by the selected 7d/30d/90d/all selector. It answers:

1. consistency: trained days, sessions, and sessions per active day;
2. recorded movement: empty, insufficient, or an evidence-backed comparison;
3. next consideration: one domain with a plain reason and a route to its details.

## Level 2: domain evidence

The existing domain summary and `/progress-domain?domain=...` route remain below/behind the overview. The new focus action enters that same domain-detail ownership instead of inventing a second summary.

## Level 3: game history

The existing Progress game rows continue to enter ordinary Game Detail, while Game Detail's existing detailed-trends action enters the deeper Progress Game route. This preserves the observed route graph and makes the handoff from identity/play context to longitudinal history explicit.

## Level 4: advanced history

Activity, personal-best/workout analytics, category/co-occurrence, full history, and mastery remain available after the summary. No depth was deleted to make the first viewport simpler.

## Sparse and sample rules

No sessions produces an empty state and a rating-start explanation. One selected session produces an explicit “not enough to describe movement yet” state. A movement delta is only narrated when the helper has at least two selected sessions.

