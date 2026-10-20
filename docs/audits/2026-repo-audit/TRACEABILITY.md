# Audit-finding → change traceability (2026-10-19)

**Purpose.** The "Change partition" table in `FINDINGS.md` was written before the
implementing changes were numbered, so every row after `069` names a change id
that does not exist (a consistent one-number drift plus one capability rename).
Nothing in the change folders references the `F-xx` ids either, so the
audit→fix chain lived in exactly one prose table with wrong pointers (explore
finding F-3). This file is the corrected, verified mapping.

Mapping was verified against change content (e.g. `versionToNumber`/`begin()`
in `074`, `Tappable`/`accessibilityState` in `071`, the safe-back catalog guard
in `072`, `applyReroll` in `073`, adapter re-entrancy in `068`), not inferred
from numbering.

| Finding | Title (short) | Implementing change (actual id) | Register's stale name |
|---|---|---|---|
| F-01 | Expo doctor gate red vs recorded 21/21 | `069-dependency-gate-restoration` | (correct) |
| F-02 | Adapter re-entrancy wedges the app | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-03 | Divergent test storage model | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-04 | Backup overwrite not atomic | `070-backup-transport-atomicity` | `071-backup-transport-atomicity-and-robustness` |
| F-05 | Import error-string amplification | `070-backup-transport-atomicity` | `071-backup-transport-atomicity-and-robustness` |
| F-06 | Data Management zeroed inventory | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-07 | Tab/root navigation stack growth | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-08 | `Tappable` accessibilityState lost | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-09 | `memo` absent from shared kit | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-10 | Unused `react-native-reanimated` | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-11 | Incompatible `MinTouchTarget` exports | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-12 | `versionToNumber` contract drift | `074-sdk-module-contract` | `075-sdk-module-contract-and-session-safety` |
| F-13 | `begin()` duplicate-start orphan | `074-sdk-module-contract` | `075-sdk-module-contract-and-session-safety` |
| F-14 | Workout leg advance not durable | `073-workout-lifecycle-durability` | `074-workout-lifecycle-durability` |
| F-15 | Future-leg launch ownership tuple | `073-workout-lifecycle-durability` | `074-workout-lifecycle-durability` |
| F-16 | Workout abandon/skip missing | `073-workout-lifecycle-durability` | `074-workout-lifecycle-durability` |
| F-17 | Deadline guard covers only `games/**` | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-18 | Superseded design-system/GAME_SDK docs | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-19 | Vacuous session-lifecycle gate | `074-sdk-module-contract` | `075-sdk-module-contract-and-session-safety` |
| F-20 | Reducer `default` guard cannot fail | `075-game-reducer-exhaustiveness` | `076-game-reducer-exhaustiveness-enforcement` |
| F-21 | Unprovable exhaustiveness comments | `075-game-reducer-exhaustiveness` | `076-game-reducer-exhaustiveness-enforcement` |
| F-22 | Profile zeroed fallback as data | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-23 | Data Management no back affordance | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-24 | Progress focus reload stale window | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-25 | Oversized route files | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-26 | game-detail "Back to Games" label | `072-navigation-and-error-surfaces` | `073-navigation-state-and-error-surfaces` |
| F-27 | Theme/sensory shared context | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-28 | Reduced-motion first-mount race | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-29 | Toast overflow drops messages | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-30 | Shared-primitive coverage gaps | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-31 | No behavioral game-module contract | `074-sdk-module-contract` | `075-sdk-module-contract-and-session-safety` |
| F-32 | Orphan shared components | `071-shared-ui-contract-integrity` | `072-shared-ui-contract-integrity` |
| F-33 | `applyReroll` CAS asymmetry | `073-workout-lifecycle-durability` | `074-workout-lifecycle-durability` |
| F-34 | Untracked assistant-config dirs | `069-dependency-gate-restoration` | (correct) |
| F-35 | Connection init parity gap | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-36 | Schema-guard heal name-only | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-37 | Unbounded read path | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-38 | Progression sync no transaction | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-39 | Newer-schema import silent | `070-backup-transport-atomicity` | `071-backup-transport-atomicity-and-robustness` |
| F-40 | Dot-prefixed backup hidden | `070-backup-transport-atomicity` | `071-backup-transport-atomicity-and-robustness` |
| F-41 | Export never self-validated | `068-storage-adapter-runtime-parity` | `070-storage-adapter-reentrancy-parity` |
| F-42 | Dependency-audit gate red | `069-dependency-gate-restoration` | (correct) |
| F-43 | CI OpenSpec non-strict/old CLI | `069-dependency-gate-restoration` | (correct) |
| F-44 | Exit-2 BLOCKED indistinguishable | `069-dependency-gate-restoration` | (correct) |
| F-45 | Governance prose incoherent | `069-dependency-gate-restoration` | (correct) |
| F-46 | MASTER_PLAN.md stale | `069-dependency-gate-restoration` | (correct) |

All 46 findings were dispositioned at Phase 10 terminal certification
(`docs/redesign/evidence/phase10-terminal-certification/TERMINAL_CERTIFICATION.md`,
2026-10-04). Spot-verified repairs in current code (2026-10-19 explore):
F-04 (`data-portability/replacement.ts`), F-08 (`components/ui/tappable.tsx`),
F-13 (`use-game-session.ts`), F-20/F-21 (`assertExhaustive` in game reducers),
F-40 (`file-transport.ts` name rejection), F-46 (MASTER_PLAN v2).
