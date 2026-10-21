# Next-operator handoff — Campaign 079

**Ending revision:** `9c4dd138` · **State:** Campaign 079 closed VALIDATED
with explicit limitations; overall release verdict CONDITIONAL GO.

## Where everything lives

| Artifact | Path |
|---|---|
| Authoritative certification matrix | `docs/certification/079-release-certification/release-matrix.md` |
| CI recovery report | `docs/certification/079-release-certification/ci-recovery.md` |
| Product acceptance matrix | `docs/certification/079-release-certification/product-acceptance.md` |
| Performance report | `docs/certification/079-release-certification/performance.md` |
| Security report | `docs/certification/079-release-certification/security.md` |
| Governance report | `docs/certification/079-release-certification/governance.md` |
| Executive report | `docs/certification/079-release-certification/executive-report.md` |
| Evidence-audit findings (9, all fixed) | `qa-artifacts/079-evidence-audit-findings.md` (gitignored copy retained locally) |
| Program tasks / dispositions | `openspec/changes/079-stabilization-acceptance-certification/tasks.md` |
| Durable state | `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`, `.agent/GOVERNANCE.json` |

## Exact commands

```bash
node scripts/validate-repo-state.mjs                 # governance consistency
node scripts/certification/validate-cli-contracts.mjs # CLI-contract gate (new)
node scripts/validate-dependency-audit.mjs            # security policy gate
npx --yes @fission-ai/openspec@1.9.0 validate --all --strict
cd apps/mobile && npm run typecheck && npm run test:ci && npm run lint
```

## Remaining external requirements (in priority order)

1. **Owner product acceptance** — open the app (emulator or device) and judge
   taste/feel; the reviewed surfaces are dispositioned KEEP in
   product-acceptance.md but only the owner can approve.
2. **Physical Android + ARM64 device run** — install
   `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
   (or the CI artifact from Android Build Smoke run 39547028543) on real
   hardware; re-run the journey list in product-acceptance.md §1.
3. **iOS runtime** — simulator run on a macOS host; compile-only evidence is
   NOT runtime certification.
4. **Screen-reader validation** — TalkBack journey with the semantic IDs
   verified in the UI hierarchy dumps.
5. **Fresh native re-execution of the 41/42 games** not journeyed this
   session (use ARTEMIS natural-language journeys — uiautomator-dump latency
   exceeds round timers and cannot drive gameplay).
6. **decode-uri-component exit** — at the next Expo SDK upgrade, check
   whether expo-router's query-string line carries the fixed decoder; drop
   the allowlist entry if so (expires 2027-03-31 regardless).

## Environment notes

- Dedicated AVD `braintraining-qa36` (x86_64, 1080x1920); boot via
  `scripts/android/avd.sh boot --no-snapshot --retry 3` (this host's adb
  registration window is tight; a detached manual launch also works).
- Local multi-ABI native builds may hit the ninja `build.ninja still dirty`
  race; clear `node_modules/**/android/.cxx` and build
  `-PreactNativeArchitectures=x86_64` for QA APKs (see performance.md §4).
- ARTEMIS lives at `D:\Tools\artemis` (external; `subst D: C:\VirtualD` on
  this host). Provider credential is owner-supplied via
  `scripts/qa/set-artemis-key.mjs`; never commit it.
- Branch protection is active: pushes to `main` are allowed for
  administrators after local `greenMain` checks; force-push/deletion are
  blocked for everyone (ruleset 25523614). PRs must show the four required
  checks green and up to date.

## Next defensible action

Run requirement 1 (owner acceptance) and 2 (physical device) in parallel; the
engineering side has no remaining actionable in-scope defect.
