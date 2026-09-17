# Evidence map — Campaign 029 ARTEMIS migration

This is a bounded migration evidence map, not a product redesign audit.

Live qualification continuation (2026-09-17): the external checkout is local
at `2ef304b` over the previously established `26124b4` / upstream `371aa6d`;
the external dotenv credential resolves through the generic OpenAI Responses
adapter without entering this repo. Direct Muse Spark 1.3 Contributor text,
XHigh, multimodal, and structured-tool probes passed, and the offline audit
found 20/20 active roles on Muse with no fallback. The first MCP Settings trace
is invalid because stderr showed the obsolete Gemini startup prewarm. A fresh
Codex MCP session then produced passing Settings, Brain Training Flash, and
Brain Training Pro evidence; the provider-dependent tasks are now validated.

| Item | Evidence source | Required disposition |
|---|---|---|
| External tool location and upstream revision | `D:\Tools\artemis`, official `google/artemis` checkout, revision `371aa6d` | Keep outside Git; record revision only |
| Provider/device readiness | ARTEMIS doctor summary, ADB serial `emulator-5554`, helper status | Safe readiness summary; no credential material |
| Live model/provider qualification | Direct Muse probes, effective role audit, and fresh ARTEMIS traces `9aaa2db9-5743-4bf9-9835-ab5b537fb622`, `e927ade5-2b2d-4e2f-a150-7c316230a85d`, and `5908e678-4b6d-4abf-8ece-2fcc41b3cc67` | `PASS`; historical `4340ff06-befd-4af7-9404-527940fa68a9` remains invalid |
| Obsolete repository driver | `scripts/qa/autobot.mjs`, `.gitignore`, CI/certification/self-test/docs references | Remove current code/invocations; historical records may remain labeled historical |
| Preserved app seams | `apps/mobile/src/sdk/testid.ts`, `apps/mobile/app.json`, GameHost QA hooks, metadata/logging | Offline contract and source checks |
| Codex integration | Upstream generator/merge output and `codex mcp list` | Only `artemis` block; preserve unrelated config |
| Product health | TypeScript/Jest/lint/validators/build/install | Record exact current-head outcomes in `.agent/VALIDATION.md` |

## Fresh-session closure evidence

- Settings Flash visibly opened Android Settings → Battery and observed `100%`
  and `Charged`; task-specific trace inspection found no Gemini, Union Alpha,
  or alternate-provider request.
- Brain Training Flash visibly completed Home → Games → Grid Recall, completed
  its tutorial through the normal UI, recalled five of five cells for score 100,
  observed the normal result, and returned to Home without a crash or system
  error.
- Brain Training Pro visibly completed Today's Workout → Cue Keeper, an
  observed timeout result, pause/resume with result preservation,
  background/foreground with auto-pause recovery, and safe stop/relaunch to a
  coherent Home state. The direct trace reported 85
  `openai_responses:muse-spark-1.3-contributor` calls with `fallback: none`.
  Its optional verifier subchecks were `INCONCLUSIVE` because the same Muse
  route rejected verifier schemas; this does not change the direct runtime
  evidence classification.
- The local ARTEMIS session-header propagation fix is committed only in the
  external checkout at `2ef304bbe17aa4fa80de033ead32000a33e74c41`; it was not
  pushed to Google's repository. No credential material is stored here.
