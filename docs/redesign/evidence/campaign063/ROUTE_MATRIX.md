# Campaign 063 — Route & Recovery Matrix

`ui-capture` harness, light + dark, all route-verified + nonblank:

- default/light + default/dark: home, games, game-detail, progress,
  profile, rewards — **12/12 PASS** (manifest:
  `D:\Temp\campaign063-matrix\manifest.json`, raw outside Git).
- Data Management via deep link: 76 nodes, real counts (profile
  present, 1 workout instance), 062 copy live on device.
- Invalid game id (`braintraining://game/does-not-exist`): unknown-game
  fallback ("Game not found", guidance wrapped per 058, Back to
  library) — 20 nodes, no crash.
- Unknown results id: empty Results ("No sessions yet", Back) — 22
  nodes, no crash, no strand.
- a11y audit over the 12 captures: 0 unlabelled nodes; the 4 Progress
  window tabs (94×32dp visual) meet 44dp via the shared Tappable
  hit-slop contract (055 classification, unchanged); remaining clipped
  nodes are scroll-under-tab (expected). 0 TRUE_UNDERSIZED_TARGET.
- The audit exits nonzero by design on the classified tabs (8
  "violations" all in the known classes above) — recorded, not hidden.
