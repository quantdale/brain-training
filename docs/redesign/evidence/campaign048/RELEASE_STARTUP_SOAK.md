# Campaign 048 Release Startup Soak

**Artifact:** existing Metro-independent release APK from the Campaign 045
validated product source  
**Sample:** 3 cold force-stop/relaunch cycles  
**Device:** `emulator-5554`

| Cycle | `am start -W` TotalTime | Semantic Home/workout readiness |
| --- | ---: | ---: |
| 1 | 6,324 ms | yes; approximately 24,732 ms to the content poll |
| 2 | 5,002 ms | yes; approximately 23,662 ms to the content poll |
| 3 | 5,866 ms | yes; approximately 21,325 ms to the content poll |

All three screenshots showed the Home route and the `Today's Workout` card.
The Activity launch timing and semantic content timing are intentionally
separate. The latter includes UIAutomator dump/pull overhead and the normal
Home skeleton-to-content transition, so it is not reported as pure startup
latency.

After the sample, `MainActivity` was the resumed activity. The filtered
app-PID logcat result was zero for:

```text
FATAL EXCEPTION, AndroidRuntime, ANR, ReactNativeJS error/fatal,
Unable to load script, redbox, SQLiteException, database is locked,
OutOfMemory
```

The earlier debug Metro sample showed splash/black frames beyond its bounded
20-second probe while the split bundle and bootstrap completed, then rendered
Home. That result is retained as a dev-client/tooling boundary and is not
substituted for the release result.
