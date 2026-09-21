# Campaign 067 — log review

**Command (re-runnable):**

```powershell
adb -s emulator-5554 logcat -d | Select-String -Pattern `
  "FATAL EXCEPTION|isn't responding|ANR in|SQLiteException|SQLiteConstraintException|RedBox|E ReactNativeJS"
```

**Result:** **0 matches** over 5,180 log lines covering the clean
install, six launches (including offline), the route/recovery probes,
the provider open/cancel flows, the full completion journey, the
relaunch, and the export/share flow.

No `ANR in com.braintraining`, no `FATAL EXCEPTION`, no SQLite
exceptions, no RedBox, no ReactNativeJS errors. The full dump is kept
outside Git at `D:\Temp\campaign067-logcat.txt` (raw logs are not
committed by convention).
