# Audit Map — Campaign 049

| Area | Evidence | Required check |
| --- | --- | --- |
| Responsive surfaces | `D:\Temp\campaign049-matrix\` | six surfaces × light/dark × compact/font-scale-2; nonblank and route verified |
| Interactive targets | `campaign049-*-a11y.json` | no `<44 dp` or unlabelled interactive nodes; report clipped viewport entries separately |
| Fixed chrome | captured tab bars and hierarchy dumps | large text does not make tab labels collide or hide navigation |
| Scroll/safe area | surface screenshots and XML | bottom content remains reachable and native tab inset is explicit |
| System/sensory | Campaign 038/043 evidence plus current settings | reduced-motion and document/share boundaries are truthful and restored |
| State matrix | `STATE_MATRIX.md` | each required state is newly tested, inherited with source match, or explicitly pending |
| Source decision | current SHA and focused regression | no speculative repair; rerun every changed surface |
