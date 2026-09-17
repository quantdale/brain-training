# Evidence map — Campaign 029 ARTEMIS migration

This is a bounded migration evidence map, not a product redesign audit.

Live qualification continuation (2026-09-17): the external checkout is local
at `07ecb21` over compatibility `e70ca52` / upstream `371aa6d`; the external
dotenv credential resolves through the adapter without entering this repo. The
target AVD/helper is ready, but the bounded OpenCode Go Messages probe and one
same-session retry both returned HTTP 503, so provider-dependent task rows stay
`BLOCKED` / `NOT VALIDATED`.

| Item | Evidence source | Required disposition |
|---|---|---|
| External tool location and upstream revision | `D:\Tools\artemis`, official `google/artemis` checkout, revision `371aa6d` | Keep outside Git; record revision only |
| Provider/device readiness | ARTEMIS doctor summary, ADB serial `emulator-5554`, helper status | Safe readiness summary; no credential material |
| Live model/provider block | ARTEMIS traces for attempted Settings task | `BLOCKED` / `NOT VALIDATED`, never pass |
| Obsolete repository driver | `scripts/qa/autobot.mjs`, `.gitignore`, CI/certification/self-test/docs references | Remove current code/invocations; historical records may remain labeled historical |
| Preserved app seams | `apps/mobile/src/sdk/testid.ts`, `apps/mobile/app.json`, GameHost QA hooks, metadata/logging | Offline contract and source checks |
| Codex integration | Upstream generator/merge output and `codex mcp list` | Only `artemis` block; preserve unrelated config |
| Product health | TypeScript/Jest/lint/validators/build/install | Record exact current-head outcomes in `.agent/VALIDATION.md` |
