# Campaign 047 Backup/Restore Matrix

**Device:** `emulator-5554`  
**Backup:** `brain-training-backup_2026-09-18_19-39-25.json`  
**Schema:** 12

| Operation | Observed result | Mutation |
| --- | --- | --- |
| Export Backup | Saved backup created; loaded JSON manifest reported 272 records, 44 sessions, 44 ledger entries, and 87 rating-history rows. | Expected export write only |
| Load saved backup | Full JSON loaded into the Import/Restore input. | No database write |
| Preview Merge | **Valid** — would add 0 sessions and 0 ledger entries. | No database write |
| Preview Replace | **Valid** — would restore 44 sessions and 44 ledger entries after erasing current data. | No database write |
| Apply Merge / Replace | Not applied on retained catalog database. | Intentionally not run |
| Malformed merge preview | **Invalid (malformed)** — `Backup is not valid JSON.` | No database write |

Before and after the non-destructive previews/invalid input, the on-screen
Data Management inventory remained:

```text
44 Sessions · 8 Ratings · 87 History · 44 Ledger
0 Favorites · 9 Quests · 0 XP awards
```

The repository suite separately applies merge/replace to disposable test
databases, including a mid-import failure that restores the exact prior state.
This is the destructive-operation evidence; the retained device database was
not used as a disposable target.
