# Evidence map — Campaign 029 ARTEMIS migration

This is a bounded migration evidence map, not a product redesign audit.

Live qualification continuation (2026-09-17): the external checkout is local
at `26124b4` over the previously established `07ecb21` / upstream `371aa6d`;
the external dotenv credential resolves through the generic OpenAI Responses
adapter without entering this repo. Direct Muse Spark 1.3 Contributor text,
XHigh, multimodal, and structured-tool probes passed, and the offline audit
found 20/20 active roles on Muse with no fallback. The first MCP Settings trace
is invalid because stderr showed the obsolete Gemini startup prewarm; that
prewarm is removed, but the post-fix Codex MCP transport closed before a fresh
task could run. Provider-dependent Android task rows stay `BLOCKED` /
`NOT VALIDATED`.

| Item | Evidence source | Required disposition |
|---|---|---|
| External tool location and upstream revision | `D:\Tools\artemis`, official `google/artemis` checkout, revision `371aa6d` | Keep outside Git; record revision only |
| Provider/device readiness | ARTEMIS doctor summary, ADB serial `emulator-5554`, helper status | Safe readiness summary; no credential material |
| Live model/provider block | Direct Muse probes plus ARTEMIS trace `4340ff06-befd-4af7-9404-527940fa68a9` and the post-fix MCP transport result | `BLOCKED` / `NOT VALIDATED`, never pass |
| Obsolete repository driver | `scripts/qa/autobot.mjs`, `.gitignore`, CI/certification/self-test/docs references | Remove current code/invocations; historical records may remain labeled historical |
| Preserved app seams | `apps/mobile/src/sdk/testid.ts`, `apps/mobile/app.json`, GameHost QA hooks, metadata/logging | Offline contract and source checks |
| Codex integration | Upstream generator/merge output and `codex mcp list` | Only `artemis` block; preserve unrelated config |
| Product health | TypeScript/Jest/lint/validators/build/install | Record exact current-head outcomes in `.agent/VALIDATION.md` |
