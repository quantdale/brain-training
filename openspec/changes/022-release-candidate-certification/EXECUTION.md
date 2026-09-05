# Execution Entry — Campaign 022 Release-Candidate Certification

**Status:** VALIDATED — closed 2026-09-06; release verdict CONDITIONAL GO
**Change:** `022-release-candidate-certification`
**Baseline:** `76a58dccf819c57364d5531c2ca4c2bc3c375e46` (head declaring 021 VALIDATED with all four workflows green)
**Target branch:** `main`
**Predecessor:** `021-release-gate-reconvergence` (VALIDATED)

## Mission

Move the repository from "repository-owned automation complete" to the
strongest defensible release candidate: disposition release-relevant tracked
debt with adversarial proof; build, inspect, and standalone-run a clean
Android release artifact; execute broad runtime certification (games, Workout
V3, lifecycle/process death, real SQLite, backup/restore, offline,
accessibility, SAF, physical device, performance); classify every platform
evidence domain honestly; re-prove the full automated matrix and all four
workflows at the exact final SHA; and issue an evidence-backed
GO / CONDITIONAL GO / NO-GO verdict.

## Execution order

1. Debt triage (priority: `xp_awards` idempotency) — fix or prove-safe.
2. Clean release artifact build + inspection.
3. Standalone artifact runtime on `braintraining-qa36` + broad game
   certification.
4. Workout V3 + lifecycle torture + DB soak + backup/restore certification.
5. Platform evidence (accessibility, SAF, physical device, perf, offline,
   security, iOS per host capability).
6. Full regression matrix + current-head CI at final SHA.
7. Release-readiness matrix, verdict, durable-state truth repair, closure.

## Scope guard

No game #43+, new systems, cloud/auth/monetization/AI/social/notifications,
architecture or database replacement, unrelated dependency upgrades, or
speculative cleanups. Validators, tests, and gates may be strengthened, never
weakened. Generated native directories follow repository gitignore policy.

## Stop conditions

Stop for a user decision only on a proven external blocker (credentials,
absent platform hardware, irreversible publication). Never convert
unavailable evidence into PASS. Physical-device/iOS/macOS absence must not
stall executable Android certification work.

## Progress log

### Phase 1 — debt triage (complete, `7461f6b`)

`xp_awards` idempotency: proven safe or repaired per adversarial matrix; see
`VALIDATION.md` Phase-1 entry. Remaining tracked debt classified NON-BLOCKING
MAINTENANCE unless re-opened by certification findings.

### Phase 2/3 — release artifact + standalone run (in progress)

- Release APK rebuilt from fixed head (14:46 local): SHA-256
  `574998fd7212bad09c8c8ae81fd2d789acbe9bade137cda7aa538a6983035a30`,
  109,292,277 bytes. Metadata + manifest inspection recorded in
  `VALIDATION.md`.
- Standalone release install on `braintraining-qa36` executed through the new
  `scripts/qa/release-driver.mjs` hierarchy driver (Metro-independent).
- **Release blocker found + fixed** (`c8826c6`): `ScreenShell` ScrollView
  content row lacked `flexGrow`, so game screens collapsed to intrinsic
  height; the first-run tutorial card's `maxHeight: 88%` clamp then laid the
  "Try a demo" button OUTSIDE its own card with zero rendered height —
  fresh-install users could not start any game requiring a tutorial.
  Dev-build autobot missed it (persisted tutorial state + dev-only QA skip).
  Device-reverified on the fixed bundle: tutorial completable; legitimate
  8-round card-sort completion (0 wrong picks, score 800 = normalized 0.8,
  xp 34, duration 193,850 ms), exactly-once session row, `integrity_check ok`,
  row survives `am force-stop` + relaunch.
- **Certify preflight defect found + fixed** (`4a7a699`): the Home
  `source-bundle-bound` marker was 1×1 `opacity: 0`; uiautomator drops
  alpha-0 views, so `--mode certify` could never observe it. Raised to
  2×2 `opacity: 0.01` (imperceptible, present in the hierarchy).

### Phase 4 — registry-wide certification

- Full `autobot --mode certify` on the fixed dev client at the bound SHA:
  result recorded below when complete (see `qa-artifacts/`).
- Standalone release legitimate-play certification: card-sort journey proven
  end-to-end; release-driver resource-id matching fixed (Expo testIDs carry
  no package prefix) in `44f74ad`.


### Phase 4 — registry-wide certification: 42/42 PASS (`d82c57e`)

- Definitive run `qa-artifacts/20260905-114509-autobot-certify/run.json`:
  COMPLETED, certified true, 42/42 PASS with row invariants. All 18 earlier
  failures individually root-caused (probe coverage, probe ordering,
  stale-dump pulls, never-idle tickers, testID placement, pass-criteria
  contracts) and re-proven PASS individually before the clean run.
- Product fixes: vigilance TIMER_TICK_MS 100→250 ms; SymbolView testID onto
  Pressable. Harness hardened with fail-closed evidence preserved.

### Phases 5–8 — workout/lifecycle/DB/backup: PASS

- Workout V3: daily 4/4, focus 4/4, resume 2/2 (mid-workout kill/relaunch),
  short 2/2. Template-chip hunt fix in harness.
- Lifecycle torture ALL-PASS: mid-session kill (no partial row),
  results-screen kill (exactly one row), pause→background→resume, 3×
  relaunch stable, integrity ok.
- Backup/restore user path PASS: export, idempotent merge, corrupt rejection,
  wipe (keeps backups), replace-restore exact, restart stable. Product fix:
  import TextInput `maxHeight: 240` (`61aea07`).

### Phases 9–15 — platform classification (evidence in VALIDATION.md)

- Offline airplane-mode PASS (launch/game/workout/export). Security scout
  PASS. A11y static + hierarchy PASS (0 unlabeled); manual TalkBack NOT
  VALIDATED. SAF sheets NOT VALIDATED (app-side PASS). Physical device NOT
  VALIDATED. iOS runtime NOT VALIDATED (no macOS); compile via CI.
- Perf: cold 4.4–5.9 s dev/emulator, warm 9 ms; no pathology.

### Phases 16–18 — convergence (`61aea07`)

- Full matrix green: Jest 6101/5-skip, tsc, lint, doctor 21/21, all
  validators, self-test 51/51.
- Final release APK `2487a2fd` (109,292,293 B) rebuilt from `61aea07`;
  standalone re-verified (tutorial demo mounts, first-run gate opens).
- Verdict: **CONDITIONAL GO** — no repository-owned blocker remains;
  store signing + manual TalkBack/SAF/physical/iOS-runtime are external.

