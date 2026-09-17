# Campaign 034 before/after Profile evidence

## Capture setup

- Device: dedicated `braintraining-ui35`, serial `emulator-5554`.
- OS: Android 15 / API 35.
- Package: `com.braintraining.app`.
- Capture command: `node scripts/qa/ui-capture.mjs --device emulator-5554
  --out <dir> --surfaces profile,rewards --theme light,dark --settle-ms 800`.
- Both captures used the same persisted one-session state. Every manifest
  entry was `routeVerified: true` and `blank: false`.

## Pixel files

| Surface | Before bytes / SHA-256 | After bytes / SHA-256 |
| --- | --- | --- |
| Profile light | 223,797 / `D84B3ADDB61C00B9EF1F25E15F5B7CD713667B8FDE8A27960F77B371EFC1C69E` | 233,729 / `33AB56C55390EF52AA256ACB0FD9B8446DA6AF5C6D18872C55909CA535F8D74B` |
| Profile dark | 212,808 / `40408EC1F1966AC71ECC9F917AE5DCB98D073110EE394B961B7739FD1E9CC5BE` | 220,488 / `15C652458138AD82974B7EA0E04DD125F8F0B1970EFED2472D207786F96EDB71` |
| Rewards light | 264,217 / `D81BB9F28630E164BD7020ADBF47370CCE224CAC591BB84BFCBE07CF3352B012` | 263,679 / `A9BB16EE2E226850CB1C7B2A055CCF81905C126ED98588814DE92586E8563EAF` |
| Rewards dark | 239,102 / `DD4510E8F0C624901E72DB160549CD6AF9714109118B522E06380C0611A2EE8B` | 238,509 / `66AEADA06C04F43314678F263D10B85044FA5DF06AF9714109118B522E06380C0611A2EE8B` |

The Rewards screen had no source changes in this campaign; its small byte
and hash differences are retained as capture facts, not treated as a product
comparison claim.

Before manifest: `D:\Temp\campaign034-runtime-before\manifest.json`.
After manifest: `D:\Temp\campaign034-runtime-after2\manifest.json`.

## Observed visual change

Before Profile showed a large identity card followed by a streak card, direct
claim actions in motivation lists, and a duplicate cosmetic gallery. After
Profile shows the identity card, a visible Motivation grouping, status-only
motivation rows, and one Rewards grouping/entry. The actual after pixels were
inspected in both themes; the dark surface remained readable and the new
section hierarchy was visible.

The emulator-local scroll captures show the lower groups without relying on a
first-viewport assumption:

- `D:\Temp\campaign034-runtime-after2-lower\profile-scroll6.png` shows the
  Rewards entry with `1 ready to claim`, followed by Data Management.
- `D:\Temp\campaign034-runtime-after2-lower\profile-scroll7.png` shows the
  Settings grouping and Theme controls.
- The corresponding UIAutomator XML contains `profile-rewards-entry`,
  `profile-rewards-pending`, `profile-data-management`, and `profile-settings`.
