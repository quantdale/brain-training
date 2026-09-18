# Campaign 042 — Defect Repair Log

| Finding | Severity before repair | Evidence | Repair/disposition | Current status |
| --- | --- | --- | --- | --- |
| `NativeDatabase.prepareAsync` NPE during Android runtime teardown/startup | Medium/High reliability risk | Exact release NPE in pre-repair logcat and font-transition replay | Serialize by native handle, use `useNewConnection: true`, coalesce initialization; add focused tests | `[REPAIRED_AND_REVALIDATED]` |
| Results Play Again action partially clipped at font scale 2 | Medium accessibility/reachability defect | Pre-repair XML showed only ~26 dp visible | Local `fontScale >= 1.5` Results hero density adjustment; no content/order change | `[REPAIRED_AND_REVALIDATED]` |
| Ordinary card-copy edge clipping in compact/large-text captures | Low visual observation | Games/Home audit notes; no actionable control clipped | No source change justified; recorded as non-actionable | `[DOCUMENTED_DEBT]` |
| Expo SDK 57 patch-version drift | Low maintenance/dependency policy item | Expo Doctor 20/21 | Left isolated; dependency refresh is outside this defect campaign | `[EXTERNAL_MAINTENANCE_DEBT]` |
| Human/iOS/physical/store/system-sheet evidence | Platform boundary, not a reproduced product defect | See `HUMAN_PLATFORM_BOUNDARY.md` | Explicitly not claimed | `[NOT_VALIDATED]` |

No unresolved Critical, High, or Medium product-correctness defect remains from
the Campaign 042 observation set.
