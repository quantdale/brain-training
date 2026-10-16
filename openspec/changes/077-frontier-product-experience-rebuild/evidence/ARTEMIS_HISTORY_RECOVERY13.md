# ARTEMIS13 — bounded tool-history recovery

A reproduced external ARTEMIS operator defect interrupted sibling tool results
with supplemental image messages. The repair and a subsequent live continuation
qualify this operator path; they do not prove every earlier provider400 shared
one cause or that all upstream agent paths are repaired. ARTEMIS remains external
at `D:/Tools/artemis`, HEAD `2ef304bbe17aa4fa80de033ead32000a33e74c41`.
No external controller source, traces or credentials are copied into Git.

The failed Transform Match controller
`efb6e256-851a-487d-86c1-88c329f5ad61` was cancelled after 1370.23s while the
same unsaved Easy game was at Round 4/4. Its trace records multiple
`get_step_screenshot` requests followed by a provider400 insufficient-tool-results
error. The exact rejected wire request was not persisted. Offline extraction of
the actual `OperatorNode._invoke_llm_loop` and tool-wrapper functions reproduced
a matching mechanism: all call IDs had results, but roles were
`assistant → tool → user(image) → tool → user(image)`. The first image carrier
interrupted the required contiguous sibling result block.

Root changed only the final operator output-batch append boundary, after helper
results and action acknowledgements are collected. Stable ToolMessage-first
ordering now appends all sibling tool results before supplemental HumanMessages,
preserving original message objects, IDs, statuses, content and order within each
category. Action dispatch and image content are unchanged. The external backup
is `D:/Tools/artemis/artemis/agents/operator/operator.py.bak-campaign077-history13`,
SHA256 `8e55ca24bde0e080a421552f76eb32df0f8998c593929c54b650af338e816e60`.
The patched `operator.py` SHA256 is
`a9adac56b8f20e4197a21c87febd8c27d2e950ba39d466b746060b773d423759`.
Pre-existing external LLM/configuration edits were left untouched. No provider,
credential or `.env` change was part of this recovery.

The offline valid-history expectation failed before the patch with exit 1 and
passed afterward with exit 0. The preserved records show the old actual-method
status `rejected_missing_contiguous_results`, then `accepted`, with the latter
roles `user → assistant → tool → tool → user → user`. Candidate-only simulation
was not used for the after-valid verdict. Eleven classified positive/negative
protocol controls include missing-result, wrong-ID, image and error carriers;
negative controls remain deliberately invalid rather than being relabeled green.
These checks use synthetic model/tool responses and make no provider/device calls.

Independent read-only review found no concrete introduced P1/P2 and exercised
seven additional actual-method cases: single/three image carriers, two text
results, two tool-carried images, two error images, helper image plus action
acknowledgement, and helper error plus deferred action. It verified exact message
and payload preservation, contiguous replies and image-carrier order. The first
review collector failed after those assertions on an optional key absent from
an older diagnosis record. Reading optional fields with `get` corrected only the
collector; the same scenarios then passed without changing their behavior or
external source. The review predates the live run and correctly states live
provider recovery was then unproven.

Root used the supported idle restart with no browser opening. Optional Showcase
auto-build failed because Node 24.3.0 is below its Angular CLI requirement;
the daemon nevertheless started and diagnosis was ready 5/5. This is a tool-UI
build limitation, not a device-journey PASS. Existing malformed worker histories
were not rewritten; the next continuation used a newly loaded worker.

Live Pro continuation `45e4dc33-c519-406d-88f7-7eaa20eb6814` completed 521.4s.
It continued the same unsaved Transform Match game without force-stop, reset,
replay or an intervening APK install, then reached the saved leg2 boundary.
After saving, the operator requested screenshots for two recorded steps in the
same tool-call batch; the following provider request returned HTTP 200. The
preserved stdout contains no HTTP 400/insufficient-tool-results event in that
run. This is direct live confirmation for the repaired batched-screenshot path,
not a blanket guarantee for other loops or arbitrary mixed-tool histories.

Later native13 task `4300edb1-f7be-4c98-8b8e-4cecf2df2fe1` reaches actual saved
four-leg completion but again records HTTP400 during finalization, with all
seven final checks INCONCLUSIVE despite terminalCOMPLETED. Its original stdout
and checker ledger are retained. This does not erase the earlier red/green/live
batch proof, but it contradicts a blanket controller-history repair claim.
No further speculative external patch has been applied. Root separately verifies
actual pixels and SQLite in [RUNTIME_WORKOUT13.md](RUNTIME_WORKOUT13.md).

That continuation ran on native12/af9bd997, APK
`949c13470c88bdc646e3458fa6764573b2f79de9d6b97cbb3db6fd19781ea459`.
It is distinct from native13 build/install proof in
[NATIVE_PREVIEW13.md](NATIVE_PREVIEW13.md) and does not qualify native13 gameplay,
full workout completion, important-only paused-tree pruning or final profiles.
Root's later separate SQLite verification qualifies actual saved data. Its
runtime and cue limits remain in [RUNTIME_WORKOUT12.md](RUNTIME_WORKOUT12.md).

The following records remain ignored under `qa-artifacts/campaign077/`; the
external stdout stays in its original ARTEMIS trace directory.

| Record | SHA256 |
| --- | --- |
| artemis-history13-diagnosis.json | c84c72737db72c271a54036bca07db8cbf6af7989b1046d2cbbc611c8a429544 |
| artemis-history13-before-valid.json | eefe660c613acc69087720b4064c97bdd6a6835a0e2ae978de3022f7182ea8e9 |
| artemis-history13-after-valid.json | 64ac7c4c121b9db513bf9644de41cce824ea2295c2a46016b5e9b7548533c2fe |
| artemis-history13-independent-review.json | 5ced4e892ace03e97d84b8d5177dc2ff6811bcdb8f11da8728a02d0d00381f04 |
| artemis-transform12-recovery13-watch-latest.json | aa6bc0487c39dc79fa3acdbef9b08efe747824be2485b2638dd7333f4cf7da85 |
| restart-artemis13.log | 9bd3c55d90825da83a364b446ffa77bc9c59add75c3bf3fe0390c2ec1e9abade |
| external traces/45e4dc33-c519-406d-88f7-7eaa20eb6814/stdout.log | 99f91c4f25c54c3c07fb2cf2a5b41a606d269c815b1709a6d350afab5e595b0d |
