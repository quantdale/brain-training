# Campaign 052 — Visual Acceptance Review & GitHub Screenshot Packet

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** observation-only visual acceptance review; evidence capture; no product implementation  
**Starting visual candidate:** Campaign 051 Signal Arcade / Cognitive Arcade Console  
**Campaign 051 terminal commit:** `32ee930`  
**Primary evidence root:** `docs/redesign/evidence/campaign052/`

---

## 0. Mission

Campaign 051 is technically complete, but the next decision is intentionally **not** another implementation campaign.

The operator wants an independent visual acceptance packet that can be committed to GitHub and reviewed later by another ChatGPT session through the GitHub connector.

The purpose is to answer:

> Does the current Signal Arcade build actually look desirable, memorable, and worth reopening when experienced as a real app?

This campaign must produce **durable, reviewable visual evidence**.

Do not redesign anything.

Do not “improve” the UI during this run.

Do not make the screenshots look better through one-off state manipulation, special debug styling, post-processing, or selective hiding.

The reviewer needs to see the real product as it currently exists.

---

## 1. Hard scope boundary

This campaign is **read-only with respect to product/runtime source**.

Allowed repository changes:

- Campaign 052 evidence Markdown;
- optimized screenshot files;
- contact sheets;
- screenshot manifest / hashes;
- review notes;
- optional UI hierarchy/XML excerpts only when small/useful.

Not allowed:

- changing app source;
- changing themes/tokens;
- changing tests;
- changing dependencies;
- changing generated registry;
- changing OpenSpec product requirements;
- fixing visual defects;
- modifying game mechanics;
- modifying persistence;
- modifying CI/workflows.

If a severe functional defect is observed, document it. Do not repair it in this campaign.

The goal is unbiased evidence before the next design decision.

---

## 2. Git safety

At startup:

1. fetch remote `main`;
2. inspect branch, HEAD, `origin/main`, worktree, worktrees, and stashes;
3. preserve concurrent/user work;
4. synchronize safely;
5. record the exact starting SHA;
6. identify the exact product/source SHA represented by the screenshots.

Never:

- force-push;
- reset away unknown work;
- overwrite concurrent changes;
- hide dirty state.

Because this campaign adds evidence only, clearly distinguish:

- **product/source SHA** being reviewed;
- **final evidence commit SHA** containing the screenshot packet.

---

## 3. Runtime requirements

Use a **current release APK** built from the exact product/source SHA being reviewed.

Prefer the dedicated automation-owned Android API 35 runtime used in Campaign 051 if it is still healthy and authorized.

Do not use a user-owned emulator or physical device.

Requirements:

- Metro/dev server must not be required;
- no debug overlay;
- no transient Android system dialog in accepted screenshots;
- no loading spinner unless the screenshot is intentionally documenting loading;
- normal default phone dimensions for the primary review;
- font scale 1.0 for primary visual-review captures;
- stable theme explicitly recorded;
- screenshots must be current, nonblank, route/state verified.

If the existing emulator is contaminated, recover only the automation-owned runtime before capture.

---

## 4. Behave like a new user, not like QA

Before capturing the final packet, spend a short uninterrupted session actually using the app.

Do not begin by inspecting test IDs.

Interact through visible UI wherever practical.

Use the following journey:

1. launch Home;
2. inspect Today's Workout;
3. open Games and browse for a while;
4. open several visually different game cards;
5. choose one game;
6. inspect Game Detail;
7. enter tutorial/intro;
8. play enough of the real mechanic to understand its visual feel;
9. reach Result legitimately;
10. inspect Progress;
11. inspect Profile;
12. inspect Rewards.

The point is to experience the visual pacing and emotional peaks, not merely prove routes exist.

Use ADB/UIAutomator/ARTEMIS only as needed to reach deterministic states, but do not let automation replace visual judgment.

If computer use is available and safe, it may be used to perform this visual walkthrough. Record whether it was actually used.

---

# PHASE A — PRIMARY REVIEW SCREENSHOT PACK

## 5. Required primary screenshots

Capture the following from the **same release artifact** and normal default device profile.

At minimum:

1. **Home / Today — active or ready-to-start state**
2. **Games — main discovery/storefront**
3. **Game Detail — a visually representative game**
4. **GameHost — active gameplay**
5. **Result — completed standalone game**
6. **Progress — populated overview**
7. **Profile — main player identity surface**
8. **Rewards — populated or representative state**

Also capture, when reliably reachable:

9. **Home — completed workout**
10. **Workout final completion / result**
11. **Games — search/filter state**
12. **Dark-mode Games or Home**
13. **Dark-mode Game Detail or Result**

Do not choose only the app's prettiest states.

The packet should honestly represent the product.

### 5.1 File format and size

These screenshots are being committed specifically so a later ChatGPT session can retrieve and inspect them through GitHub.

For every primary screenshot:

- crop only device/system chrome if necessary; do not crop product content;
- resize to a review-friendly width of approximately **540 px** while preserving aspect ratio;
- save as **JPEG** with enough quality to judge typography, spacing, art, and hierarchy;
- target **<= 180 KB each** where practical;
- do not blur or beautify;
- keep text legible.

Also keep the original full-resolution screenshots outside Git if useful for the local audit.

Use names such as:

`01-home.jpg`
`02-games.jpg`
`03-game-detail.jpg`
`04-gameplay.jpg`
`05-result.jpg`
`06-progress.jpg`
`07-profile.jpg`
`08-rewards.jpg`

Store committed review images under:

`docs/redesign/evidence/campaign052/screens/`

---

# PHASE B — CHATGPT-REVIEW CONTACT SHEETS

## 6. Create compact contact sheets specifically for later connector review

Create:

`docs/redesign/evidence/campaign052/contact-sheet-primary.jpg`

It must contain the eight primary screenshots in a **2×4 or 4×2 grid**, each with a small readable label outside the screenshot.

Also create, if secondary screenshots exist:

`docs/redesign/evidence/campaign052/contact-sheet-secondary.jpg`

### Connector-friendly constraint

The contact sheets exist so a later ChatGPT session can fetch them through the GitHub connector and decode/inspect them.

Therefore:

- target each contact sheet at approximately **900–1200 px total width**;
- JPEG;
- quality sufficient to see overall layout/color/hierarchy;
- target **<= 350 KB**;
- do not embed lengthy prose;
- labels only;
- no decorative frame that distorts visual judgment.

If practical, additionally create a very small:

`contact-sheet-preview.jpg`

Target **<= 60 KB**.

This preview is not the authoritative detail source; it is a low-bandwidth connector preview.

---

# PHASE C — SCREENSHOT MANIFEST

## 7. Create VISUAL_REVIEW_MANIFEST.md

Write:

`docs/redesign/evidence/campaign052/VISUAL_REVIEW_MANIFEST.md`

For every committed screenshot include:

- filename;
- product/source SHA;
- APK SHA-256;
- route/screen;
- exact state;
- theme;
- device resolution/density;
- capture timestamp;
- whether state was reached through visible UI, ARTEMIS, ADB, or fixture;
- whether screenshot was resized/compressed;
- original screenshot path outside Git if retained;
- committed file SHA-256.

Also include relative Markdown image links so GitHub itself renders the packet as a visual gallery.

Example:

`![Home](./screens/01-home.jpg)`

The manifest must be useful when opened directly on GitHub.

---

# PHASE D — FIRST-IMPRESSION REVIEW

## 8. Record first impressions before reading old Campaign 051 critique

After experiencing the app, write:

`docs/redesign/evidence/campaign052/FIRST_IMPRESSION_REVIEW.md`

Do this **before** rereading Campaign 051's `VISUAL_QA_AND_CRITIQUE.md`.

Answer concisely and specifically:

### Home

- Does the first screen make you want to press Start?
- What attracts the eye first?
- Is that the correct thing?
- Does it feel like a console/training product or another dashboard?
- What feels generic?

### Games

- Do the game cards look desirable before reading metadata?
- Do several cards actually feel distinct?
- Does the catalog invite browsing?
- Does it resemble a real game library/storefront?
- Does domain identity feel coherent or repetitive?

### Game Detail

- Does the page sell the mechanic immediately?
- Is PLAY dominant?
- Does the art feel meaningful or merely decorative?
- Is there enough visual fantasy?

### Gameplay

- Does gameplay feel like the main event?
- Does app chrome recede sufficiently?
- Does interaction feedback feel tactile?
- Does the game visually feel more special than a form/card UI?

### Results

- Is there an emotional peak?
- Does completion feel satisfying?
- Is there enough reward/delight to want another round?
- Is the next action obvious?

### Progress

- Is it attractive without compromising credibility?
- Does it still look like analytics software?
- Is domain color/motif use helpful?

### Profile / Rewards

- Does Profile feel like player identity rather than settings?
- Do Rewards feel collectible/desirable?

---

## 9. Answer the operator's actual acceptance questions

Include a section titled:

`## Operator acceptance test`

Answer each with:

- `YES`
- `MIXED`
- `NO`

and 1–3 sentences of evidence.

Questions:

1. Does Home make you want to press Start?
2. Do the game cards actually look interesting?
3. Does the app have a recognizable personality?
4. Does Game Detail make the games seem exciting?
5. Does gameplay visually feel like the main event?
6. Does Results provide enough satisfaction?
7. Is dark mode desirable rather than merely functional?
8. Does anything still scream “AI-generated app UI”?
9. Is there any surface where the immediate reaction is still “boring”?
10. Would a child/teen plausibly browse longer than one minute based on appearance alone?
11. Would an adult still perceive the product as credible and intentional?

Do not inflate scores to defend Campaign 051.

---

# PHASE E — DESIGN CRITIC PASS

## 10. Independent critic

If subagents are available, run at least one independent **read-only visual critic** that was not responsible for Campaign 051 implementation.

Give it the final screenshot packet but do not prime it with “Campaign 051 was successful.”

Ask it to identify:

- generic UI patterns;
- overused card grammar;
- weak focal points;
- weak game fantasy;
- weak art direction;
- poor type hierarchy;
- inconsistent shapes;
- color misuse;
- dark-mode weaknesses;
- child/teen appeal weaknesses;
- adult-credibility weaknesses;
- interfaces that could belong to any app;
- strongest 3 surfaces;
- weakest 3 surfaces.

If no independent subagent is available, document that limitation.

Write:

`docs/redesign/evidence/campaign052/INDEPENDENT_VISUAL_CRITIQUE.md`

Do not let the critic modify code.

---

# PHASE F — REFERO COMPARISON, NOT NEW DESIGN

## 11. Compare the implementation with the Campaign 051 reference intent

Use Refero if available to retrieve the important reference styles/screens again.

Do not start fresh implementation research.

Compare the screenshots against the intended traits:

- Playdate-like object confidence;
- authored dark mode;
- strong poster/game identity;
- tactile controls;
- Brilliant-like task focus;
- satisfying completion;
- game-library desirability.

Record where implementation:

- successfully embodies the intent;
- became diluted;
- drifted into generic UI;
- became too noisy;
- still lacks media/art energy.

Write this into:

`docs/redesign/evidence/campaign052/REFERENCE_REALITY_CHECK.md`

---

# PHASE G — NO FIXES, JUST DECISION INPUT

## 12. Produce a visual-debt map

Create:

`docs/redesign/evidence/campaign052/VISUAL_DEBT_MAP.md`

Do not propose code-level implementation yet.

For each major surface classify:

- `KEEP`
- `REFINE`
- `RETHINK`
- `REPLACE_DIRECTION`

Use evidence from screenshots and the critic.

For every `RETHINK` or `REPLACE_DIRECTION`, state the visual problem—not the solution.

Example:

Bad:
> Add a bigger gradient hero.

Good:
> Home has no single visual object that creates desire; title, progress, and CTA compete at equal visual weight.

This document will inform the next campaign after a human/ChatGPT review.

---

# PHASE H — DURABLE REVIEW INDEX

## 13. Create REVIEW_FOR_CHATGPT.md

Create:

`docs/redesign/evidence/campaign052/REVIEW_FOR_CHATGPT.md`

This is the landing page a later ChatGPT session should fetch first.

It must contain:

1. product/source SHA;
2. evidence commit SHA placeholder if needed, updated before terminal push if practical;
3. APK SHA-256;
4. one-sentence purpose;
5. relative link/image to `contact-sheet-preview.jpg`;
6. relative link/image to `contact-sheet-primary.jpg`;
7. links to each individual screenshot;
8. links to:
   - `FIRST_IMPRESSION_REVIEW.md`
   - `INDEPENDENT_VISUAL_CRITIQUE.md`
   - `REFERENCE_REALITY_CHECK.md`
   - `VISUAL_DEBT_MAP.md`
   - `VISUAL_REVIEW_MANIFEST.md`
9. explicit statement:

> Product source was not modified by Campaign 052; this packet exists for visual acceptance review before any further redesign campaign.

This file should make the GitHub evidence easy to navigate without searching.

---

# PHASE I — VALIDATION OF THE EVIDENCE ITSELF

## 14. Verify screenshot authenticity

Before committing:

- confirm every screenshot corresponds to the intended current release APK;
- verify no stale Campaign 051 before-image is mislabeled as current;
- verify images are nonblank;
- verify product content was not cropped away;
- verify no system dialog contaminates accepted images;
- verify contact sheets use the same final images;
- compute hashes;
- ensure image links render correctly from Markdown paths.

Do not selectively exclude ugly but representative states.

---

## 15. Repository impact check

Before final commit verify:

- no product-source files changed;
- no dependency files changed;
- no test files changed;
- no generated product registry changed;
- only Campaign 052 evidence assets/docs are staged.

If unrelated pre-existing changes exist, preserve and document them rather than mixing them into the Campaign 052 commit.

---

# PHASE J — FINAL VERDICT

## 16. Allowed verdicts

Use exactly one:

### `CAMPAIGN_052_VISUAL_ACCEPTANCE_PACKET_COMPLETE`

Use when:

- current release build was genuinely walked through;
- required primary screenshots were captured;
- committed review images exist;
- connector-friendly contact sheet exists;
- first-impression review exists;
- operator acceptance questions were answered;
- independent critic was run or its unavailability documented;
- reference reality check exists;
- visual debt map exists;
- no product source was modified;
- evidence was committed and pushed.

### `CAMPAIGN_052_VISUAL_ACCEPTANCE_PACKET_PARTIAL`

Use if meaningful evidence exists but required surfaces/contact sheets/review docs are incomplete.

### `CAMPAIGN_052_BLOCKED`

Use if the current app cannot be reliably rendered/captured or evidence integrity cannot be established.

---

## 17. Git completion

Commit and push the evidence packet to `main` under existing repository policy.

Final state should preferably be:

- `HEAD == origin/main`;
- clean worktree;
- no temporary branches/worktrees;
- product source unchanged.

Final CLI report must state:

- verdict;
- starting SHA;
- reviewed product/source SHA;
- final evidence SHA;
- APK SHA-256;
- screenshot count;
- contact-sheet paths and sizes;
- whether computer use was used;
- whether ARTEMIS was used;
- whether Refero was used;
- operator acceptance YES/MIXED/NO summary;
- three strongest visual surfaces;
- three weakest visual surfaces;
- count of KEEP / REFINE / RETHINK / REPLACE_DIRECTION;
- confirmation that no product source changed;
- HEAD/origin/worktree status;
- exact GitHub path to `REVIEW_FOR_CHATGPT.md`.

---

# 18. Core directive

**Do not defend Campaign 051. Review it.**

Experience the current app like a user.

Capture what it really looks like.

Commit a small, high-quality visual evidence packet to GitHub.

Make the packet easy for a later ChatGPT session to retrieve and inspect.

Do not fix anything yet.

The next redesign decision should be based on the actual product pixels, not on the implementing agent's confidence.
