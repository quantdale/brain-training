## Context

See `proposal.md` for motivation and the three capability specs for observable behavior. The Explore-stage release baseline is in `evidence/README.md` and `evidence/before/index.json`: 20 real Android PNGs, source SHA `d3d0b9926a44c039d7fd0d29e1376586afaa897b`, APK hash, emulator and state labels. It is **partial**: no active-game or result captures, no compact phone or iOS. Preserve and extend the old-build baseline before touching each presentation. A previous redesign's certification is historical context, not proof for this reboot.

Repository inventory: 42 registry-backed games in eight domains; all 42 `screen.tsx` files render `GameHost` and `GameResults` and retain local styles; 209 per-game component `.tsx` files own much of the board/interaction language. The shared shell therefore cannot deliver a product-wide reboot alone. Home/workout, Games/discovery, game detail, active play and in-game results, standalone `/results`, Progress, Rewards, Profile/settings and storage/recovery routes have independent composition and state owners. React Native/Expo, SQLite and the shared mandatory Game SDK remain. ARTEMIS is the sole authoritative natural-language Android runtime-QA controller (`D:\Tools\artemis`, external environment); `scripts/android/` remains capture/provisioning, not a gameplay driver. One dedicated emulator is shared by the orchestrator.

### Refero research: borrow interaction roles, not branding

Marketing **style references** (not evidence of in-app layouts): [Playdate](https://refero.design/styles/c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2) pairs strong yellow *brand fields* with violet *CTA* and flat, collectible game-preview units; its yellow must not silently become the CTA. [Peloton](https://refero.design/styles/1b7e4f5c-c3c2-48d5-8f34-3ecdd17f422e) uses charcoal stage, white type, singular red *CTA* and minimal rectilinear imagery. [V–A–C](https://refero.design/styles/ffef8672-f789-4329-8895-47e50f517d31) uses a monochrome editorial grid, raw content imagery, no accent CTA color and strict square geometry; its desktop-scale empty space must not hide mobile actions. Also evaluated [Le Puzz](https://refero.design/styles/7e31e67d-effb-46e9-8690-6a848555fda0): yellow CTA and sharp puzzle packaging, rejected as a primary prototype because it would sit too close to Playdate's broad color impression.

Actual **product screen/flow references**: [Brilliant correct-answer screen](https://refero.design/screens/cf1e5091-af40-4c51-8f06-9dee0549c3f8) places prompt, answer and chart in one vertical reading order and reserves a bottom feedback/action zone; [Imprint wrong-answer screen](https://refero.design/screens/8d3c2abd-7646-44b0-9bb6-cbd43dea4b4f) makes correction, right answer and Continue explicit; [Duolingo question screen](https://refero.design/screens/8b5fa757-a8d6-46a0-97ae-cee018f41e61) separates a lightweight progress rail from large answer targets and a visible Check action. [Imprint Daily Quiz flow 5647](https://refero.design/flows/5647) establishes intro → answer → correct/incorrect feedback → result → exit. [Brilliant operator puzzle flow 4355](https://refero.design/flows/4355) shows selection → Check → retry/reveal/explain → XP → updated course state. These sequences inform our state hierarchy, **not** our scoring, copy, imagery or currency rules; our game mechanics and offline storage remain authoritative.

## Goals / Non-Goals

**Goals:** a real on-device compositional difference across destinations and mechanics; one coherent visual grammar with clear action priority; every game reviewed individually; actionable accessibility and device evidence. A selected direction must survive both attractive screenshots and real play on small/large-text devices. Preserve identifiers, saved data, workout provenance and scoring.

**Non-Goals:** a new gamification economy, new games, a content/generator overhaul, cloud sync, asset cloning, or a foundational animation/rendering dependency. This change is not an automatic full-hardening campaign; address Critical/High regressions, use the impact map for risk-based validation, and record lesser debt.

## Decisions

### 1. Run three isolated, executable visual hypotheses before selecting a system

Each prototype covers the **same** seeded journey: Home → Games → detail/first-run instruction → active board → correct and incorrect feedback → result/next action → Progress; show both a spatial/recall interaction (Memory) and a discrete manipulation interaction (Equation Builder), with dark/light and large-text review. Prototype surfaces are dev-only and cannot silently ship. Produce paired emulator captures and a scorecard: 30% playability, 25% accessibility, 20% first-viewport action clarity, 15% distinctiveness, 10% feasibility. A blocking accessibility or loss-of-progress defect disqualifies a direction regardless of score. The selected system is **undecided** until this gate; no single-reference clone or averaged beige compromise.

| Candidate | Foundation and distinctive move | Role discipline and media plan | Risk to test |
| --- | --- | --- | --- |
| **A: Pocket Console** | Playdate-inspired bold console-like **yellow stage**, grounded dark text and tactile violet action; large code-native game pieces fill a short, deliberate play window, not a decorative hero. Flat collectible library previews with genuine static game-board stills. | Yellow = identity/sections, violet = primary action, dark neutrals = type; teal only for a justified state, never a generic extra accent. One sturdy sans family; no photographic console mockups, mascot or weak CSS imitation. Game previews need genuine assets or aspect-ratio placeholders with art direction until captured. | Energy becoming visual noise at 2× text or overwhelming actual puzzles. |
| **B: Training Studio** | Peloton-inspired charcoal immersive play stage, white type, a single red action focus, disciplined progress rail and compact instrument-like result metrics. Imagery is the authentic board/diagram, cropped tightly rather than stock athletics. | Charcoal = canvas, white = reading, red = primary action only; error uses explicit text/icon/shape rather than misusing red as generic failure. Dark-first, independently designed high-contrast light counterpart. Rectilinear content, softened large action. | Too severe for broad-age learners; red CTA must remain distinguishable from errors. |
| **C: Puzzle Index** | V–A–C-inspired stark white/ink grid, typographic puzzle prompts and real content-first board stills; distinct numbered route/round markers and square, rule-based tiles. Quiet confidence instead of arcade. | Black/white = foreground/background, gray = decorative rule only, never low-contrast essential copy. Primary action is typographic with clear border/size, **not** an invented accent color; no shadow or gradient. For dark mode invert the ink/canvas roles, preserving angular grammar. | Source's minimal ghost actions and huge desktop gaps may fail mobile affordance/first-screen clarity. |

The final **reference lock** must name one foundation, 1–2 permitted borrowed details, explicit rejects, exact *product-owned* color/typography/type-scale/spacing/surface/touch/motion/media tokens, source-token role constraints, accessibility pairings, and primary-screen compositions. This document is a prototype brief, **not** that final lock. If no candidate passes, revise and re-test a candidate; do not ship an unvalidated blend.

### 2. Build a shallow shared visual contract and deep mechanic-owned boards

Use existing `theme/tokens`, `components/ui`, `components/game-ui`, `game-host`, discovery and workout seams for consistent semantic type, color roles, space, actions, progress, feedback sheets, accessible motion and result chrome. `GameHost` retains lifecycle and persistence boundaries; do **not** move scoring or generator rules into view code. Each game's board/prompt/options/animation remain inside its module, so memory recall, timed vigilance, text assembly and spatial transforms keep different silhouettes. Preserve existing game/version metadata, deterministic seeds, semantic IDs, source-safe QA controls and RN `Animated`/`usePressFeedback` convention. If a new shared interface is necessary, one integrator owns that file and updates callers through agreed contracts; major rewrites require an ADR first.

### 3. Stage rollout by visible player journeys and isolated game ownership

First land one coherent Home → browse → detail → tutorial → play → feedback → saved result → workout-next journey with a few mechanism-diverse canaries, then converge shared surfaces. Next assign eight domain **game modules** as disjoint ownership packets (max seven concurrent coders, no shared registry/theme/navigation edits by game owners). After each wave the integrator checks canary play, device screenshots and regression risk, not every game at once. The last domain is a second wave if seven writers are already active. No wholesale replacing game screens with the same generic template. Route owners for Progress, Rewards, Profile, standalone Results and data/recovery work against the locked system, with separate write surfaces. The manifest checks 42/42 *individual* active boards and relevant states at the end.

**Catalog audit roster (IDs, not claims of visual review):**

| Domain | Individual game IDs to assess |
| --- | --- |
| Attention (5) | `attention-odd-one-out`, `attention-sustained-vigilance`, `attention-symbol-tracker`, `attention-target-count`, `attention-visual-search` |
| Flexibility (5) | `flexibility-card-sort`, `flexibility-color-stroop`, `flexibility-cue-shift`, `flexibility-rule-flip`, `flexibility-task-switch` |
| Language (5) | `language-context-fit`, `language-sentence-builder`, `language-word-chain`, `language-word-match`, `language-word-scramble` |
| Logic (5) | `logic-code-cracker`, `logic-deduction-table`, `logic-next-sequence`, `logic-order-path`, `logic-rule-grid` |
| Math (5) | `math-equation-builder`, `math-fast-math`, `math-missing-operator`, `math-number-line-estimation`, `math-value-ordering` |
| Memory (7) | `memory`, `memory-grid-recall`, `memory-pair-recall`, `memory-pattern-tap-back`, `memory-prospective-cue`, `memory-running-order`, `memory-sequence-memory` |
| Spatial (5) | `spatial-coordinate-turn`, `spatial-fold-match`, `spatial-grid-nav`, `spatial-mental-rotation`, `spatial-transform-match` |
| Speed (5) | `speed-color-match`, `speed-order-sweep`, `speed-quick-compare`, `speed-reaction-time`, `speed-tap-rush` |

### 4. Treat evidence as a versioned matrix, not an anecdote

Before touching each state, use the **old** installed release APK (hash in evidence) and the dedicated emulator to collect missing baseline via ARTEMIS's supported Codex MCP `mobile_run_task`/`mobile_manage_task`/`mobile_inspect_trace`; `doctor` first. ADB/script capture may collect hierarchy, screenshots and diagnostics, not drive gameplay. If the MCP interface is unavailable in the current harness, record the precise blocker; do not replace it with host mouse/keyboard, a homemade gameplay script or a fake green. For every route/state and game ID, record build/SHA, deep link or navigation path, seed/fixture, resolution/density/font scale/theme, observed screenshot/hierarchy/trace, reachable/not validated, human visual notes and action outcome. Capture after on the **same** configurations. Keep sensitive provider config and raw traces outside Git; commit only scrubbed evidence and index with hashes. A route screenshot is not an active-play review; static code inspection is not device QA.

Target Android matrix: default light/dark on primary dedicated phone; 2× font scale in both themes on key routes and each interaction family; a sequential compact phone profile and a larger layout profile; reduced-motion and accessible labels/contrast/touch audit. One AVD at a time. Check iOS independently where a simulator/build is available; mark NOT VALIDATED/BLOCKED when not. Preserve a compact set of matched captures per game and richer representative state journeys per domain, plus route-level empty/loading/error/success coverage. Use real screenshots as game-preview media only after sanitizing and generating stable assets; otherwise keep intentional aspect-ratio placeholders. Final review must literally inspect before/after images and confirm hierarchy, legibility, differentiation and affordances.

### 5. Guard behavior and rollback with explicit contracts

Run repo/impact-map validation, type/lint/unit/integration checks as affected; Android build/install/start, seeded ARTEMIS first-run/workout/resume/completion/diagnostic journeys, 42-game device audit, accessibility/theme/size review and iOS independent evidence. UI edits must not alter game score, local persistence, reward ledger or workout CAS. A Critical/High regression stops expansion. Ship in coherent commits with a startable `main`; if rollout fails, revert the last presentation packet (without rolling back unrelated stored user data). No force-push or silent behavior migration.

## Risks / Trade-offs

- [The current baseline covers only 20 static screens] → complete old-build state/device captures **before** respective view edits; mark unreachable states NOT VALIDATED and block full acceptance.
- [42 local game boards overwhelm shared-style fixes] → explicit per-ID review, separate domain owners, mechanism-diverse canaries and measured device screenshots.
- [A high-impact visual identity reduces puzzle legibility or adult trust] → equal-journey on-device prototypes, weighted scorecard, 2× type and real play; reject failed direction.
- [Changed chrome regresses scoring, completion or accessibility automation] → retain SDK boundaries/test IDs, fixture controls and risk-based canaries; release-build runtime checks and corrective commits.
- [ARTEMIS/MCP or iOS tooling may be unavailable] → record precise NOT VALIDATED/BLOCKED status and avoid claiming full certification or improvising host-input automation.
- [Evidence can include personal data and external credentials] → use fresh deterministic local data, audit images/metadata before Git, keep traces/provider config outside the repo.

## Migration Plan

1. Finish old-build baseline and full route/game-state inventory; preserve matched device metadata.
2. Prototype and score the three systems in an isolated dev-only harness; commit a chosen reference lock before production rollout.
3. Implement shared structure and a complete canary journey; validate persistence, navigation and restart.
4. Roll out remaining routes and eight isolated game-domain packets, converging shared hotspots centrally and capturing matched after images.
5. Run full visual/interaction acceptance, Android ARTEMIS journeys, required impact-map gates and separately report iOS status; document remaining medium/low debt. Commit and push only coherent, buildable checkpoints.
6. Roll back by corrective commits/revert of the relevant UI packet if a Critical/High regression appears; do not discard stored game/session state or rewrite `main` history.
