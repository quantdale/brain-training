# Campaign 049 Responsive and Accessibility Matrix

All captures used the release APK installed on `emulator-5554` and retained a
PNG plus a compressed UI hierarchy XML. Each requested surface was deep-link
started, route-verified, and nonblank.

| Profile | Themes | Surfaces | Capture result | Audit result |
| --- | --- | --- | --- | --- |
| Compact, 720×1600 @ 320dpi | light/dark | Home, Games, Game Detail, Progress, Profile, Data Management | 12/12 PASS | 0 violations; 58 interactive and 58 labelled nodes |
| Font scale 2.0, 1080×2400 @ 420dpi | light/dark | Home, Games, Game Detail, Progress, Profile, Data Management | 12/12 PASS after tab-label repair | 0 violations; 48 interactive and 48 labelled nodes |

Post-fix manifests and audits:

- `D:\Temp\campaign049-matrix-fixed\manifest.json`
- `D:\Temp\campaign049-fixed-compact-a11y.json`
- `D:\Temp\campaign049-fixed-a11y.json`

The pre-fix font-scale-2 run is retained at
`D:\Temp\campaign049-matrix\font-scale-2` and was the reproducer for the
native bottom-tab label collision. Its audit also reported zero measured
violations; the visible collision was a fixed-chrome visual defect outside the
44dp/name counters.

The audit retained six compact clipped entries (three per theme) and two
font-scale-2 clipped entries (one per theme). These are rows partly beneath
the native tab bar at the captured scroll position; the audit explicitly marks
them `clipped` and excludes them from target-size violations. The content is
scrollable and the existing settled-scroll evidence remains valid.
