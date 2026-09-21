# Campaign 067 — startup matrix

**Artifact:** `B7AA4102…` (`ARTIFACT.md`) · **Target:** dedicated
`emulator-5554` · clean install (`adb uninstall` then `adb install`).

| Launch | Kind | Result |
|---|---|---|
| cold 1 | first launch after clean install | **PASS** — Status ok, TotalTime 5,454 ms, Home rendered (`BRAIN TRAINING`, `Home`, today's workout 0/4 "Fold Match", tabs) |
| cold 2 | force-stop + start | **PASS** — 2,057 ms |
| cold 3 | force-stop + start | **PASS** — 2,416 ms |
| warm | start with process alive | **PASS** — TotalTime 0 ms (no-op foreground) |
| offline | airplane mode on, force-stop + start | **PASS** — 3,715 ms, Home rendered offline |
| post-journey | force-stop + start after a completion | **PASS** — 2,629 ms |

ANR watch: zero `ANR in com.braintraining`, zero ANR dialogs, zero
`FATAL EXCEPTION` across the whole session log (5,180 lines filtered at
`LOG_REVIEW.md`). First-install ANR (historically observed once in 050)
was **not reproduced** in this bounded sample (1 clean install + 5 cold
launches), consistent with 054/063.
