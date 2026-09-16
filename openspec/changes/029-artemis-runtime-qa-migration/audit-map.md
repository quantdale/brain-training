# Evidence map — Campaign 029 ARTEMIS migration

This is a bounded migration evidence map, not a product redesign audit.

| Item | Evidence source | Required disposition |
|---|---|---|
| External tool location and upstream revision | `D:\Tools\artemis`, official `google/artemis` checkout, revision `371aa6d` | Keep outside Git; record revision only |
| Provider/device readiness | ARTEMIS doctor summary, ADB serial `emulator-5554`, helper status | Safe readiness summary; no credential material |
| Live model/provider block | ARTEMIS traces for attempted Settings task | `BLOCKED` / `NOT VALIDATED`, never pass |
| Obsolete repository driver | `scripts/qa/autobot.mjs`, `.gitignore`, CI/certification/self-test/docs references | Remove current code/invocations; historical records may remain labeled historical |
| Preserved app seams | `apps/mobile/src/sdk/testid.ts`, `apps/mobile/app.json`, GameHost QA hooks, metadata/logging | Offline contract and source checks |
| Codex integration | Upstream generator/merge output and `codex mcp list` | Only `artemis` block; preserve unrelated config |
| Product health | TypeScript/Jest/lint/validators/build/install | Record exact current-head outcomes in `.agent/VALIDATION.md` |
