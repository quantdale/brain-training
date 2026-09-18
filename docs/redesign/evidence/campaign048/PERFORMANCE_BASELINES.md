# Campaign 048 Performance Baselines

The provided probe command was run from the repository root:

```text
node scripts/perf/run-probes.mjs
```

Both Jest-backed probe suites passed. The timestamped JSON outputs are tracked
under `scripts/perf/baselines/`.

## Query/progress/export probe

| Scenario | Result |
| --- | ---: |
| `listRecent` 5,000 full rows | 20.3353 ms |
| lightweight projection 5,000 | 2.3114 ms |
| distinct activity dates 5,000 | 1.5971 ms |
| progress snapshot 5,000 | 45.3733 ms |
| `listRecent` 20,000 full rows | 72.2530 ms |
| lightweight projection 20,000 | 9.6284 ms |
| distinct activity dates 20,000 | 4.9014 ms |
| progress snapshot 20,000 | 103.5355 ms |
| export 5,000 including checksum/canonical JSON | 2,601.3613 ms |
| second backup serialization 5,000 | 571.3672 ms |

## Sync-scan probe at 20,000 rows

| Scenario | Result |
| --- | ---: |
| Build quest samples | 2.1352 ms |
| In-memory quest evaluation | 25.4531 ms |
| Quest progress sync | 29.6354 ms |
| Build achievement snapshot | 23.2158 ms |
| Achievement sync | 26.0138 ms |
| Distinct activity dates | 4.5096 ms |

These are repeatable repository/node measurements, not Android frame-time or
physical-device guarantees. They passed without a source change, so no
speculative optimization was introduced.
