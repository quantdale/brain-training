# Campaigns 033–040 — Overnight Product Redesign Roadmap

**Repository:** `quantdale/brain-training`  
**Starting product state:** Campaign 032 complete at `6c9957b12d09e486b48a96d96588fe8b319cec51`  
**Mode:** sequential evidence-driven implementation packets; partial later packets are explicitly allowed  
**Primary rule:** current runtime/source evidence outranks historical documentation  

## Purpose

This roadmap exists so one long autonomous session can continue useful product work after Campaign 032 without waiting for a human between every numbered campaign.

Campaign numbers are **work packets**, not promises that every packet will be fully completed in one session. The preferred behavior is:

1. complete Campaign 033 and validate it;
2. if its exit criteria are satisfied, immediately continue to Campaign 034;
3. repeat through Campaign 040 while time, context, tools, and repository health permit;
4. if a later packet cannot be completed, leave it as an explicitly documented **PARTIAL** state with useful validated work committed and pushed;
5. never call a packet complete merely because code was written.

The session should maximize safe, validated product progress, not campaign-number velocity.

---

## Evidence discipline — mandatory for every packet

Historical campaign reports, README files, `.agent` state, OpenSpec documents, comments, snapshots, and prior screenshots are **leads, not truth**. They may be stale, incomplete, contradictory, or written against a previous SHA.

For every material decision, establish current reality using this order of confidence:

1. **Current reproducible runtime observation** on a dedicated test runtime/device.
2. **Current source, persisted state, generated data, and actual route/component behavior.**
3. **Executable tests, validators, builds, and deterministic QA probes.**
4. **Current CI/API evidence**, with external/infrastructure failures classified separately.
5. **Git history and prior runtime evidence.**
6. **Documentation and campaign narratives.**

If documentation conflicts with observed current behavior, document the contradiction and follow the observed behavior unless a higher-priority repository contract explicitly requires otherwise.

Never invent runtime findings, human findings, screenshots, accessibility results, CI success, or tool output. Mark unavailable evidence as unavailable.

---

## Common operating loop

Every campaign packet should use the same loop:

**Observe → map current behavior → state the problem → define a bounded change → implement → run focused validation → run native/runtime validation → compare before/after → repair regressions → run broader gates → record evidence → commit/push → decide whether the next packet is safe.**

Before editing a surface, inspect it in current source and, when feasible, render it. After editing it, render the same state again. Do not let snapshots or source inspection substitute for actual pixels when visual hierarchy is the claim being made.

Use available tooling aggressively but safely: Android emulators, ADB, UIAutomator, Maestro, repository QA utilities, ARTEMIS, computer-use/browser tools, Refero, GitHub tooling, local scripts, and other available assistants may all be used when they materially improve evidence or implementation. Tool output is supporting evidence, not authority. Do not copy credentials, tokens, private traces, or unrelated local data into Git.

---

# Campaign 033 — Progress Summary & Progressive Disclosure

## Product objective

Transform Progress from an analytics-heavy dashboard into an answer-first personal training history surface.

The first meaningful viewport should help the user answer:

1. **How consistently have I trained?**
2. **What has changed in my recorded performance?**
3. **What should I consider training next?**

Deep analytics remain available, but only after the summary makes sense.

## Required investigation

Observe and map the current Progress overview, time-window switching, Activity, domain detail, game-history/detail routes, sparse-data states, populated-data states, loading/error states, and offline behavior. Inspect the real analytics queries and rating/mastery semantics before changing presentation.

Do not assume Campaign 029's Progress diagnosis is still exact after Campaigns 031–032; verify current behavior.

## Authorized scope

- Progress overview hierarchy and copy.
- 7d / 30d / 90d / all time-window presentation.
- Consistency/training-frequency summary.
- Recorded-performance movement summary using existing evidence only.
- Next-consideration/focus explanation using current data semantics.
- Domain summary cards/rows.
- Progressive disclosure into Activity, domain, game history, and advanced analytics.
- Sparse/no-history/insufficient-sample/loading/error/offline states.
- Chart captions, sample/window context, textual interpretation, accessibility.
- Resolve or clarify the ownership overlap between ordinary Game Detail and Progress game-history views without losing data or navigation.
- Fix Progress-local touch-target/layout debt when encountered, including the carried-forward 43dp findings if still present.

## Protected contracts

Do not casually alter analytics formulas, rating history, mastery formulas, session persistence, scoring, generators, workout semantics, schema, backup format, provenance, offline behavior, or the cautious no-medical-claim boundary.

Use language about **recorded training performance**, recent averages, personal bests, trained days, freshness, and session history. Never translate the app's data into medical, neurological, intelligence, age-reversal, diagnosis, or guaranteed real-world-performance claims.

## Exit

Progress is summary-first, deep history remains reachable, sparse data is honest, native light/dark evidence exists, relevant accessibility/runtime/tests pass, and evidence is committed under `docs/redesign/evidence/campaign033/`.

---

# Campaign 034 — Profile, Motivation, Rewards & Ownership Simplification

## Product objective

Turn Profile into a grouped control center rather than a vertical inventory of every progression system, and make Rewards the single clear owner of claimable rewards/cosmetics.

## Investigate first

Observe current Profile, Rewards, streak protection, quests, achievements, milestones, level/XP, coins, cosmetics, settings, and Data Management. Trace actual persistence and idempotency before moving or hiding UI.

## Target ownership model

- **Local player:** identity and quiet level/XP summary.
- **Motivation:** streak, protection state, quests, achievements, milestones.
- **Rewards:** pending count/entry point from Profile; full inbox, claim-all, cosmetics, reward history inside Rewards.
- **Settings:** theme, sound, haptics, accessibility/sensory options.
- **Data:** export, backup, restore, merge/replace, destructive delete safeguards.

## Authorized scope

Recompose Profile/Rewards hierarchy, remove duplicate first-class presentations, contextualize coins/economy only where decisions require them, make claim ownership unambiguous, improve empty/error/loading states, and preserve safe destructive-action semantics.

## Protected contracts

Do not break append-only ledger behavior, claim idempotency, streak reconstruction/protection, quest/achievement definitions, cosmetic ownership/equip rules, backup/restore, export, or typed-delete safeguards. Avoid schema changes unless current source proves a minimal migration is unavoidable; if so, isolate and validate it instead of slipping it into UI work.

## Exit

Users can locate motivation, a pending reward, sensory/theme settings, and Data Management without navigating competing duplicate systems. Evidence goes under `docs/redesign/evidence/campaign034/`.

---

# Campaign 035 — Cross-Surface Visual System Consolidation

## Product objective

Make the redesigned product feel like one calm, premium cognitive-training application rather than a collection of individually polished surfaces.

This is **not** authorization for gratuitous visual churn. The structural work from 031–034 is the foundation.

## Investigate first

Render Home, Games, Game Detail, GameHost intro/play/result, Progress, Profile, Rewards, and representative empty/error states in light and dark. Audit actual token usage and one-off styling. Identify where Campaign 026 “Neon Arcade” remnants still compete with hierarchy.

## Authorized scope

- One primary action accent per state.
- Domain colors used for taxonomy/evidence rather than simultaneous decoration.
- Neutral/surface hierarchy.
- Typography scale and statistical numerals.
- Spacing rhythm and section separation.
- Card reduction where cards are only decorative wrappers.
- Shape, border, elevation, icon, and illustration consistency.
- Shared game-identity motif treatment introduced in Campaign 032.
- Charts/data-viz consistency.
- Bounded celebration.
- Motion transitions that communicate state rather than decorate everything.
- Light/dark semantic parity.

Prefer consolidating existing primitives/tokens over adding another parallel design system.

## Exit

Core surfaces visually cohere without losing accessibility, performance, semantic IDs, or the hierarchy established by earlier campaigns. Evidence goes under `docs/redesign/evidence/campaign035/`.

---

# Campaign 036 — First-Run, Empty-State & Trust Experience

## Product objective

Make a clean install understandable without requiring an account, network access, documentation, or prior knowledge of the progression systems.

## Mandatory evidence rule

Do **not** implement a large onboarding flow merely because old planning documents suggested one. First observe a true clean-install path and determine what is actually confusing.

## Authorized scope

- Clean-install Home/Today clarity.
- Optional lightweight first-run explanation only if observation supports it.
- First workout/game tutorial handoff.
- Empty Progress, empty Favorites, empty Rewards, no-history Game Detail, and Data Management zero-data states.
- Offline/local-data trust copy.
- Permission/system-sheet timing when applicable.
- Skip/revisit behavior for optional onboarding information.

No account gate, health questionnaire, forced reminder opt-in, or marketing carousel before first play.

## Exit

A clean-install user can understand what the product is, start training, and interpret empty states without fabricated data. Evidence goes under `docs/redesign/evidence/campaign036/`.

---

# Campaign 037 — Navigation, State & Cross-Surface Coherence Hardening

## Product objective

Audit the redesigned application as one product and remove navigation/state seams introduced or exposed by Campaigns 031–036.

## Authorized scope

- Back behavior and pushed-route stack correctness.
- Home ↔ Games ↔ Detail ↔ Play ↔ Result flows.
- Progress drill-down and return-context behavior.
- Profile/Rewards/Data return behavior.
- Loading/error/retry ownership.
- Resume/relaunch/background transitions.
- Deep links and invalid/missing IDs.
- Duplicate or contradictory copy/actions across surfaces.
- Remove demonstrably dead/obsolete redesign-era components only after proving they are unused.

Do not use cleanup as an excuse for a broad architecture rewrite.

## Exit

Major journeys preserve context, failures recover safely, and there are no known redesign-created navigation traps or duplicate ownership ambiguities. Evidence goes under `docs/redesign/evidence/campaign037/`.

---

# Campaign 038 — Accessibility, Device, Motion & Sensory Hardening

## Product objective

Move beyond static accessibility checks into robust operation across realistic device conditions.

## Authorized scope

- Minimum touch targets and carried-forward compact-target debt.
- TalkBack/screen-reader semantics and focus order where tooling permits.
- Large text/font scaling.
- Small and large phone widths/heights.
- Landscape only where the app claims/supports it.
- Light/dark/system theme transitions.
- Reduced motion.
- Audio/haptic disabled states.
- Color-independent status communication.
- Safe areas, keyboard/input overlap, bottom-tab overlap, scrolling/reachability.
- Android API/device matrix when practical; iOS evidence if a legitimate available environment exists.

Never claim manual TalkBack, VoiceOver, iOS, or physical-device success unless actually executed.

## Exit

High-value journeys remain operable under the tested accessibility/device conditions, with unresolved external/manual checks clearly handed off. Evidence goes under `docs/redesign/evidence/campaign038/`.

---

# Campaign 039 — Performance, Reliability & Maintenance Isolation

## Product objective

Ensure the redesigned product remains responsive and operationally maintainable without mixing speculative optimization into UI work.

## Investigate before optimizing

Measure or observe startup, route transitions, catalog scrolling/search, Progress data loading, GameHost transitions, memory/render churn where tooling allows, app background/relaunch, and persistence timing. Fix demonstrated regressions before theoretical ones.

## Authorized scope

- Render/list hot spots proven by profiling or observation.
- Unnecessary recomputation/re-rendering.
- Lazy-loading and route-boundary robustness.
- Startup and bootstrap regressions introduced by redesign work.
- Persistence/background/resume reliability.
- Error boundaries and recoverability.
- Build/runtime warnings that materially affect supported behavior.
- Re-evaluate the deferred Expo patch drift as a **separate isolated maintenance slice** only if current evidence indicates it is safe and worthwhile. If dependency updates are performed, keep them in dedicated commits and rerun full native/build/runtime validation.
- Re-check external GitHub Actions failures without blindly editing workflows to silence symptoms.

## Exit

No known redesign-created material performance/reliability regression remains; maintenance changes are isolated and evidence-backed. Evidence goes under `docs/redesign/evidence/campaign039/`.

---

# Campaign 040 — Release-Candidate Integration & Certification Pass

## Product objective

Treat the product produced by Campaigns 031–039 as a candidate integrated experience and determine what is actually ready versus still provisional.

Campaign 040 is primarily certification/hardening, not another feature wave.

## Required work

- Re-observe the complete product, not just recently edited screens.
- Run the broadest practical repository validation matrix.
- Build/install and exercise representative native flows on a dedicated normal phone runtime.
- Validate daily workout, standalone games, results, persistence, resume/relaunch, Games discovery, Progress, Profile/Rewards, Data Management, empty/error states, light/dark, accessibility, and offline operation.
- Recheck all 42 catalog entries and representative mechanics.
- Review copy for unsupported cognitive/medical claims.
- Review dead/obsolete components and unresolved TODO/debt introduced by redesign campaigns.
- Recheck current CI status and classify external failures honestly.
- Perform real human validation if independent participants are genuinely available; otherwise maintain a precise pending handoff rather than fabricating success.

## Exit states

Campaign 040 may end as any of:

- `CAMPAIGN_040_CERTIFIED`
- `CAMPAIGN_040_CONDITIONAL`
- `CAMPAIGN_040_PARTIAL`
- `CAMPAIGN_040_BLOCKED`

A conditional/partial outcome is acceptable. Truthful evidence is more valuable than an artificial green release label.

---

## Overnight progression rules

### When to advance to the next campaign

Advance when the current packet has:

- a coherent implementation slice;
- focused tests passing;
- no known severe regression in protected contracts;
- relevant native/runtime observation where feasible;
- evidence written;
- a clean, reviewable commit pushed to `main` according to repository policy.

Full exhaustive release certification is not required after every packet, but validation depth must match the risk of the change.

### When a packet may remain PARTIAL

A later packet may remain PARTIAL if the session is running out of time/context or if an external/manual dependency prevents full closure. Commit only coherent validated work. Write exactly what remains.

### When not to advance

Do not proceed into new product work when there is evidence of data corruption, duplicate irreversible writes, broken workout/session identity, broken backup/restore, broken core navigation, failing migrations, unexplained destructive behavior, or a severe regression caused by the current packet. Repair or stop instead.

External CI/service failures that are clearly independent of the current product diff may be documented and carried while local/native evidence remains strong; do not pretend they are green.

---

## Git and concurrency safety

- Prefer `main` only, consistent with the recent campaign workflow, unless current repository policy says otherwise.
- Before each campaign packet: fetch remote, compare local/remote, inspect worktree, and preserve concurrent/user work.
- Fast-forward when safe. Never `reset --hard`, force checkout over user changes, delete unknown work, or force-push.
- If remote `main` advances during the session, inspect and reconcile rather than overwriting.
- Commit coherent checkpoints frequently enough that long-session failure does not lose hours of work.
- Push after each completed campaign or meaningful partial campaign checkpoint when repository policy permits.
- Never include credentials, emulator temp data, large raw dumps, unrelated local files, or generated junk merely because they exist.

---

## Long-session handoff requirement

If the agent reaches a context/time/tool limit before Campaign 040, it must leave a durable handoff under:

`docs/redesign/evidence/overnight-033-040/OVERNIGHT_HANDOFF.md`

That handoff must state:

- starting SHA;
- final SHA;
- which campaigns are COMPLETE, PARTIAL, BLOCKED, or NOT STARTED;
- exact product files changed per packet;
- validation actually executed;
- runtime environments/tools actually used;
- ARTEMIS/computer-use availability and results;
- unresolved regressions/blockers;
- uncommitted work, if any;
- the safest exact next action.

A clean/pushed repository is preferred. If a safe commit is impossible because a slice is broken, do not hide it; leave the worktree state and reason explicit.

## Success definition

The overnight session succeeds if it produces **substantial, validated forward progress** beyond Campaign 032 while preserving core correctness. Reaching Campaign 040 is desirable but not required. A truthful Campaign 035 PARTIAL with high-quality verified work is better than eight superficial campaigns declared complete.