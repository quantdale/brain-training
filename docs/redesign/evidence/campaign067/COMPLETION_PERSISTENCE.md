# Campaign 067 — completion persistence

**Game:** `speed-tap-rush` (real interaction, no QA hooks in release).

1. Game detail → "Start game" → round 1 played via field taps (round
   failed legitimately: 0 hit / 10 missed), "Next round" → round 2
   played → session completed.
2. Results surface (in-session): `Final score 0`, `Accuracy 0%`,
   `Targets hit 0/40`, `Best streak 0`, `Perfect rounds 0/4`,
   `Best reaction —`, `XP 10`, `Reward +10 XP · +2 coins`,
   `Progress saved`, actions `Play again` / `Done`.
   - Honest weak-path completion; exactly one score statement (no
     duplicate score row — the 065 catalog guard class is not present).
   - The 065 in-session live-region change is in the certified bundle
     (`results.tsx` announcements); actual TalkBack behaviour remains a
     human/manual boundary.
3. Force-stop + relaunch → 2,629 ms; the completion persisted (below).

**SQLite audit after relaunch** (pulled `files/SQLite/brain-training.db`):

```
integrity_check = ok        user_version = 12        foreign_key_check = 0
game_sessions  = 1 row  (speed-tap-rush, xp 10, normalized_result 0)
currency_ledger = +2 gameplay
rating_history  = Speed -14, Attention -7
domain_ratings  = Speed 986, Attention 993
duplicate (session_id, domain) rating rows = 0
```

The weak result is retained across relaunch and the rating/economy
pipeline applied exactly once (no duplicate rating rows, no double
ledger entry).

**Not covered in this pass:** mid/strong normalized results and
workout-leg completion linkage (065/067 deferral) — weak-path
certification is the same scope 063 certified; the full mid/strong and
workout journey remains for the hardening phase.
