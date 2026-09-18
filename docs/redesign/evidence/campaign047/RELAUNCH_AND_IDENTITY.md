# Campaign 047 Relaunch and Durable Identity

The existing v12 release database was retained while the release APK was
force-stopped and relaunched three times. Each cycle rendered the Home route
and the `Today's Workout` content.

| Cycle | `am start -W` TotalTime | Workout content observed |
| --- | ---: | --- |
| 1 | 6,324 ms | yes; approximately 24,732 ms to the semantic content poll |
| 2 | 5,002 ms | yes; approximately 23,662 ms to the semantic content poll |
| 3 | 5,866 ms | yes; approximately 21,325 ms to the semantic content poll |

The semantic timing includes repeated UIAutomator dump/pull polling and is not
treated as a pure application-start latency. The process-launch timings are
the comparable measure; the asynchronous Home skeleton/content transition is
recorded separately for Campaign 048.

The final app-only logcat filter contained zero matches for fatal exceptions,
ANR, React Native errors, script-load failures, SQLite errors, database locks,
or OOM markers. `MainActivity` remained the resumed activity.

The release APK is non-debuggable, so `run-as` correctly refused direct SQLite
access. The release UI retained the inventory above after the invalid preview;
the direct schema/integrity audit is recorded from the same v12 data pulled
from the debug validation artifact before the release install.
