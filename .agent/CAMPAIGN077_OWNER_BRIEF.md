# BRAIN TRAINING — CAMPAIGN 077
# FRONTIER PRODUCT REDESIGN, VISUAL ART DIRECTION & 42-GAME RECOVERY

## Role: Frontier Product Architect, Creative Director & Principal Engineer

**Model:** GPT-6.1 Sol — maximum available reasoning effort  
**Repository:** `quantdale/brain-training`  
**Platform:** React Native / Expo, Android-first  
**Design research:** Refero MCP  
**Visual asset generation:** OpenAI / ChatGPT ImageGen  
**Runtime environment:** Windows, existing Android emulator with visible graphical window  
**Campaign type:** Major product redesign, gameplay correctness, visual quality and usability recovery

---

# 0. THE OWNER'S VERDICT — READ THIS FIRST

The owner personally inspected the application running in the Android emulator.

**The result was unsatisfactory.**

The previous product-wide UI/UX overhaul did not achieve the expected visual or experiential quality.

Although the application previously passed extensive automated testing, certification, and emulator validation, the actual owner experience exposed substantial problems.

The owner specifically identified:

- Weak, unattractive or inconsistent iconography.
- Insufficient visual artwork and imagery.
- Screens that do not meet modern application design standards.
- Visually unappealing compositions.
- Layout glitches, rendering defects and visual inconsistencies.
- Poor presentation across multiple games.
- Gameplay mistakes, behavioral bugs and confusing interactions.
- An overall product experience that does not feel sufficiently polished.
- Some existing components that are genuinely good and should be preserved.

**This feedback overrides the previous assumption that the interface is visually acceptable merely because automated tests passed.**

The objective of Campaign 077 is not to defend the existing UI.

The objective is to discover why the application still looks and feels unsatisfactory, then correct those problems systematically.

Do not treat existing screenshot approval, green CI, earlier OpenSpec checkboxes, or previous design reviews as proof of user-facing quality.

They remain valuable regression evidence, but they are not a substitute for present-day usability and visual judgment.

## The mandate

**Explore broadly. Critique independently. Redesign decisively. Implement completely. Validate through real use.**

You have authority to redesign weak application surfaces, replace inconsistent visual assets, improve navigation and interaction patterns, correct game mechanics, and substantially revise the shared design system.

You are not required to preserve the visual design direction of Campaign 076.

However, preserve proven product logic, data integrity, existing user progress, security boundaries, game identities, and good interface elements unless there is a demonstrated reason to change them.

This is a genuine second-generation product redesign.

It must deliver meaningful visible improvement, not another superficial pass of colors, corner radii and spacing.

---

# 1. EXECUTION PRINCIPLES

Operate as a senior cross-functional product team consisting of:

1. Principal product designer.
2. Senior visual designer and art director.
3. UX researcher.
4. Mobile interaction designer.
5. Game UX and mechanics specialist.
6. Accessibility engineer.
7. React Native architect.
8. Test and quality engineer.
9. Release and performance engineer.

You are the decision-making lead.

Use parallel read-only research and independent worktrees where useful, but retain a single authoritative design direction and carefully coordinate implementation.

Do not allow parallel contributors to introduce competing visual languages.

### Independence

Do not simply follow the owner's wording literally and produce more decorative imagery.

Investigate the underlying design problems.

For example, a screen may feel unattractive because of poor information hierarchy, lack of visual identity, weak typography, repetitive cards, awkward proportions, bland backgrounds, or inconsistent game illustration.

Icons alone may not solve the problem.

Discover the actual causes before prescribing solutions.

### Preserve what already works

Do not indiscriminately replace everything.

Classify each screen, component and game experience as:

- **KEEP:** already strong and coherent.
- **REFINE:** broadly good but needs targeted improvements.
- **REDESIGN:** structurally or visually below standard.
- **REBUILD:** fundamentally broken or unsuitable.

The final interface should retain the best existing ideas while significantly improving the rest.

### Implementation over reports

This is an implementation campaign.

Do not spend most of the session producing analysis and then stop before changing the product.

Research is the foundation of implementation, not the final deliverable.

After establishing a coherent direction, execute it.

---

# 2. REPOSITORY DISCOVERY AND BASELINE

Before any changes:

1. Synchronize with `origin/main`.
2. Verify actual HEAD and worktree state.
3. Read `AGENTS.md` and all applicable repository instructions.
4. Read the project constitution, architecture, and OpenSpec governance.
5. Inspect the entire mobile app's navigation and component architecture.
6. Inspect the game registry and all 42 game implementations.
7. Read historical Campaign 076 and 076-F findings.
8. Inspect the existing visual design tokens, icon libraries, typography, and image assets.
9. Inventory all known residual bugs and accepted debts.
10. Identify existing test and certification infrastructure.

**Historical reference point:** `c7bbf0ddfa184204027d8b6df14deab5abf87a6e`

This is a historical baseline, not a SHA to assume is current.

### Create the new change

Follow repository governance to create a new OpenSpec change:

`077-frontier-product-experience-rebuild`

Do not reopen or rewrite historical Campaign 076 evidence to make this new redesign appear previously certified.

Campaign 077 owns its implementation, visual decisions, screenshots, test evidence, and acceptance.

---

# 3. COMPLETE PRODUCT AUDIT — EXPLORE EVERY SCREEN

Launch the existing Android emulator in **visible GUI mode**.

Preferred AVD:

`braintraining-ui35`

Confirm the emulator is running the current application build.

Do not use a headless emulator for the primary visual-design assessment.

Use actual screenshots, accessibility hierarchies, navigation traces, source-code inspection, and direct application interaction.

## Audit all application surfaces

At minimum:

- Home / Today
- Daily workout
- Quick-start experiences
- Games library
- Game filtering and search
- Favorites
- Game detail
- Tutorial and instructions
- Active game screens
- Scored feedback
- Pause/resume overlays
- Game result screens
- Workout completion
- Progress
- Progress by domain
- Progress by game
- Activity history
- Rewards
- Achievements and quests
- Profile
- Settings and preferences
- Data management
- Export/import
- Backup and recovery
- Empty states
- Loading states
- Error and recovery states
- Onboarding or first-use states
- Dark mode
- Enlarged text
- Compact layouts
- Reduced-motion layouts

Do not audit only the screens that are easiest to deep-link into.

Inspect scrolling, keyboard interactions, modal states, real data, empty data, and state transitions.

### Audit rubric

Assess each surface against:

**Visual quality**
- Composition
- Hierarchy
- Typography
- Color
- Illustration
- Iconography
- Depth and layering
- Alignment
- Spacing
- Density
- Rhythm
- Perceived finish

**Interaction quality**
- Discoverability
- Feedback
- Touch responsiveness
- Gesture clarity
- Primary action placement
- Navigation predictability
- Error recovery
- Transition coherence

**Product quality**
- Cognitive load
- Clarity of user objective
- Motivation and reward
- Progress communication
- Meaningful personalization
- Consistency with the broader product

**Technical quality**
- Clipping
- Overflow
- Render instability
- Layout invalidation
- Performance
- State persistence
- Accessibility
- Incorrect game behavior

Produce an inventory of actual findings, ranked by impact and severity.

No vague observations such as "needs polish."

Every important finding should identify the affected surface, observed problem, reproduction method and proposed correction.

---

# 4. MANDATORY REFERO MCP DESIGN RESEARCH

**Use Refero MCP extensively before establishing the final visual direction.**

Discover the available Refero tools and read their actual descriptions.

Use the connector as a real design-research source, not as a ceremonial tool call.

## Research focus

Find high-quality examples of:

- Mobile brain-training experiences
- Cognitive training applications
- Gamified learning
- Educational games
- Daily habit and progression systems
- Exercise dashboards
- Game libraries
- Achievement systems
- Progress visualization
- Learning onboarding
- Visual game instructions
- Game feedback and results
- Animated microinteractions
- Design-system iconography
- High-quality empty states

Research products and design patterns resembling the level of craftsmanship associated with Duolingo, Brilliant, Elevate, Peak, and other strong mobile learning or gaming experiences.

Do not copy those products' branding, proprietary illustrations, or distinctive assets.

Study why their interfaces succeed.

### Required research output

For each major interface family, document:

1. Relevant Refero examples.
2. What makes those references effective.
3. Interaction or visual patterns worth borrowing.
4. Patterns that would not suit Brain Training.
5. A clear design decision based on the research.

Use real Refero results.

Do not invent references, search results, screenshots, or tool outputs.

If the connector is unavailable, report the limitation and pursue the work that remains possible. Do not falsely claim Refero research occurred.

## Key requirement

The application must not become a disconnected collage of unrelated reference screens.

Synthesize the research into **one coherent, recognizable, premium-quality product design language**.

---

# 5. ESTABLISH A NEW ART DIRECTION

The previous Training Studio direction is no longer mandatory.

Evaluate whether it should be refined, partially retained, or replaced.

Develop at least three meaningfully different product directions before locking the final design.

Potential explorations include:

- Playful, premium brain-training.
- Elegant and focused cognitive studio.
- Illustrated, highly interactive learning adventure.

These are exploratory directions, not prescriptions.

Use actual design references and representative screens to compare them.

Evaluate:

- Originality
- Readability
- Delight
- Game clarity
- Longevity
- Accessibility
- Asset production cost
- Design-system consistency
- Engineering feasibility

Select the strongest coherent direction.

Do not automatically choose the most decorative option.

### Visual system requirements

Establish a complete design language governing:

- Brand identity
- Color palette
- Typography scale and roles
- Icon family
- Illustration style
- Background treatments
- Surface and card system
- Spacing and alignment
- Corner radii
- Shadows and elevation
- Buttons and interactive controls
- Navigation
- Progress indicators
- Achievement treatments
- Game HUD
- Game-board presentation
- Tutorial layout
- Feedback styling
- Results and rewards
- Motion and transitions

The result must feel intentionally designed rather than assembled from default React Native components.

Create design tokens and reusable primitives.

Avoid scattered hardcoded styling.

---

# 6. CHATGPT IMAGEGEN — ORIGINAL ARTWORK AND ASSETS

**Visual asset creation is a major component of this campaign.**

Discover and use the actual available OpenAI / ChatGPT ImageGen capability.

Use the ImageGen tool exposed to the agent, or an authorized delegated image-generation workflow where available.

Do not merely write image prompts and declare the asset work complete.

Actually generate and inspect the images.

If ImageGen is unavailable, record the missing capability and continue independent implementation work. Do not pretend another tool produced ChatGPT-generated images.

## Asset strategy

Build a coherent asset system for Brain Training.

Consider generating:

- App branding concepts.
- Home hero artwork.
- Illustrated cognitive-domain identities.
- Game identity illustrations.
- Tutorial imagery.
- Empty-state illustrations.
- Achievement artwork.
- Reward artwork.
- Celebration visuals.
- Decorative backgrounds.
- Select game-specific thematic elements.

The owner explicitly wants stronger imagery and iconography.

However, distinguish between **illustration assets** and **functional icons**.

### Functional icon rules

For navigation, settings, controls, close/back actions, status, and tiny interaction glyphs:

Prefer one consistent vector icon system.

A functional icon must remain crisp at small sizes, including 16–24dp.

Do not rely on AI-generated raster illustrations for every navigation icon.

Avoid mixing unrelated outlined, filled, skeuomorphic, emoji and illustrated icon styles.

Where custom icons materially improve the brand, create a consistent, deliberate icon family with stable geometry and vector-ready production assets.

### ImageGen rules

Generate original artwork appropriate for the selected art direction.

Control:

- Palette
- Lighting
- Shape language
- Detail density
- Texture
- Composition
- Character consistency, where applicable
- Transparent-background requirements
- Crop-safe regions
- Mobile viewport suitability
- Image dimensions
- Export format

Do not accept the first generated image automatically.

Inspect each image and regenerate or revise when necessary.

Reject:

- Distorted geometry
- Unintended text
- Illegible details
- Inconsistent perspectives
- Mismatched styles
- Low-resolution assets
- Excessive visual noise
- Poor silhouettes
- Unusable transparent backgrounds
- Images that distract from gameplay

Do not ask ImageGen to create complete UI screenshots and then ship them as noninteractive application screens.

Generate reusable artwork, not fake interface functionality.

### Game illustration requirements

The game's actual mechanics must remain readable.

Never allow decoration to obscure:

- Symbols
- Numbers
- Letters
- Visual differences
- Targets
- Tap areas
- Timers
- Feedback
- Memory cues
- Response choices

For cognitive games, decorative illustration should support comprehension, not interfere with it.

### Asset production pipeline

For every accepted asset:

1. Preserve its source/provenance.
2. Record its purpose.
3. Verify dimensions and transparency.
4. Optimize file size.
5. Name it consistently.
6. Import through the appropriate application asset pipeline.
7. Test it in React Native.
8. Review it on the emulator.
9. Check both themes where applicable.
10. Verify correct crop and scaling under varying layouts.

Use responsive image containers and deterministic asset mappings.

Avoid excessive memory usage from large images.

No unlicensed third-party artwork or copied product branding.

---

# 7. REDESIGN THE APPLICATION EXPERIENCE

Implement the new visual direction across all major app surfaces.

### Home

Make Home immediately understandable and visually compelling.

The user should quickly understand:

- What to do today.
- Where to start.
- What progress they have made.
- Why continuing is rewarding.
- What activity is recommended.

Avoid gigantic decorative cards that push the primary action out of the first viewport.

Use imagery, hierarchy, progression and supporting metrics deliberately.

### Games library

The games library should feel inviting rather than like a repetitive database listing.

Improve discovery, categories, game identity, previews and filtering.

Each game should have a distinct visual personality without disrupting the shared product language.

### Game introductions

Make each game instantly understandable.

Present the cognitive objective, expected interaction and available difficulty clearly.

Ensure the primary action remains reachable.

Tutorials should feel short, interactive and useful—not like generic text sheets.

### Active gameplay

Prioritize the cognitive mechanic.

Improve:

- Board presentation
- Stimulus hierarchy
- Timer readability
- Score placement
- Action feedback
- Touch target placement
- State transition clarity
- Error prevention
- Response submission
- Pause/resume

Avoid making every game look identical at the expense of mechanic clarity.

### Results and rewards

Create a satisfying conclusion to each session.

Display meaningful performance feedback, earned rewards and useful next actions.

Celebrate genuine achievement without exaggerating weak results.

Avoid overwhelming the user with numbers or unrelated decorative elements.

### Progress

Make progress understandable and motivating.

Use readable metrics, clear trends, domain identities and appropriate visualizations.

Avoid superficial graphs that communicate little.

### Profile, rewards and settings

Bring these screens into the same visual system.

Remove generic, template-like sections.

Use purposeful information architecture and polished empty, loading and populated states.

---

# 8. AUDIT AND CORRECT ALL 42 GAMES

**This is not a UI-only redesign.**

The owner has observed gameplay errors.

Perform a serious game-by-game defect investigation.

Every game must be reviewed for correctness and usability.

## Required dimensions

**Mechanics**
- Are the rules understandable?
- Do actual interactions match the instructions?
- Are puzzle solutions and expected responses correct?
- Are target positions reliable?
- Are rounds solvable where intended?
- Are timeout rules correct?

**Scoring**
- Is the score calculated correctly?
- Are penalties and bonuses correct?
- Are displayed values rounded appropriately?
- Are weak and strong outcomes honestly classified?
- Are XP and rewards persisted exactly once?

**Input**
- Do taps register?
- Are touch targets correctly sized?
- Are there overlapping hit areas?
- Can decorative elements intercept touches?
- Is there unexpected input delay?
- Can repeated or late taps corrupt the game state?

**Lifecycle**
- Start
- Tutorial
- Active gameplay
- Feedback
- Pause
- Resume
- Quit
- Completion
- Restart
- App interruption

**Presentation**
- Correct board geometry
- Clear cues
- Legible instructions
- No clipped choices
- No floating-point UI artifacts
- No hidden buttons
- Correct visual state after answer submission
- Clear success and failure feedback

**Accessibility**
- Large text
- Contrast
- Labeling
- Touch targets
- Screen-reader semantics where supported
- Reduced motion
- Color-independent feedback

## Game review methodology

Review all 42 games, but use an efficient evidence-driven strategy.

Start with source analysis and existing tests to identify probable failures.

Prioritize shared components and defect families that affect multiple games.

Use deterministic game fixtures and focused tests whenever possible.

Use representative live interaction to confirm defects.

Do not launch 42 expensive ARTEMIS controller journeys merely to repeat what previous campaigns already covered.

The previous 42/42 acceptance establishes a useful historical baseline, but it does not override newly observed bugs.

If ARTEMIS is needed for an interaction that cheaper tools cannot reliably observe, use it selectively.

**Target low ARTEMIS consumption, not artificial avoidance of necessary real-device validation.**

For each discovered defect:

1. Reproduce.
2. Isolate the root cause.
3. Fix with minimal appropriate changes.
4. Add regression coverage.
5. Verify the affected game.
6. Assess whether the same defect affects other games.
7. Correct shared dependencies where appropriate.

Do not introduce inconsistent per-game workarounds when a shared fix is safer.

---

# 9. IMPROVE MOTION AND MICROINTERACTIONS

The new application should feel responsive, polished and alive.

Design purposeful motion for:

- Screen navigation
- Card interaction
- Button press
- Game start
- Answer submission
- Correct/incorrect feedback
- Progress updates
- Reward reveals
- Level progression
- Session completion

Motion must reinforce interaction.

Avoid distracting transitions, excessive bounce, long unskippable animations, or animations that make fast games harder to play.

Use native-friendly animations and avoid unnecessary React re-rendering.

Honor reduced-motion preferences.

Keep cognitive reaction-time measurement independent of decorative animation timing.

Measure real interaction latency where practical.

---

# 10. BUILD A HIGH-QUALITY DESIGN SYSTEM

Refactor shared UI components where necessary so the redesign remains consistent.

Consolidate:

- Colors and semantic roles
- Typography
- Spacing
- Buttons
- Icons
- Cards
- Badges
- Headers
- Navigation
- Dialogs
- Game HUD
- Game stages
- Results
- Feedback
- Motion
- Layout primitives

Do not duplicate the entire component library.

Identify reusable systems that reduce future design inconsistencies.

Preserve test IDs and external contracts unless there is a documented reason to migrate them.

Ensure the app continues to function offline.

Avoid introducing runtime dependencies on remote image hosts or cloud services.

---

# 11. VISUAL QUALITY GATES

A redesigned screen is not complete merely because it renders.

Every modified major screen must be evaluated through actual screenshots.

Capture the relevant screen in the emulator and inspect it.

Required profiles:

- Default light
- Default dark
- 2× font scale
- Compact viewport
- Representative larger viewport
- Reduced motion where applicable

Record the actual requested and observed theme separately.

Do not infer app theme from screenshot brightness.

### Visual acceptance

Reject or correct:

- Clipping
- Overlapping text
- Misaligned elements
- Inconsistent icon sizes
- Blurry images
- Broken aspect ratios
- Awkward empty space
- Overcrowded screens
- Hidden primary actions
- Low contrast
- Inconsistent spacing
- Unbalanced card layouts
- Unexpected scroll traps
- Poor touch accessibility
- Unintended layout changes
- Visual regressions between themes

Perform before/after comparisons against a newly captured Campaign 077 baseline with properly recorded provenance.

Do not silently reuse Campaign 076 screenshots as if they belong to the new build.

Do not fabricate missing historical comparisons merely to close old task 14.3.

### Independent critique

After each major implementation wave, use an independent read-only design reviewer.

Ask the reviewer to identify genuine weaknesses and inconsistencies, not merely confirm the original designer's choices.

A screen that looks generic or visually poor should not be marked complete just because it has no layout exceptions.

---

# 12. REAL RUNTIME VALIDATION

Use the existing visible Android emulator as the primary feedback environment.

Keep the emulator GUI visible for the owner.

Perform real runtime tests for major changes.

Verify:

- Cold launch without Metro
- Navigation
- Theme changes
- Gameplay
- Scored feedback
- Session results
- Workout continuation
- SQLite persistence
- Force-stop and relaunch
- Offline behavior
- Recovery states
- Settings persistence
- Asset rendering
- Memory and performance
- Logcat errors

If the agent cannot directly open a GUI window, report that limitation and provide exact owner-side launch instructions.

Never claim a visible GUI was opened without checking.

### Physical-device limitation

No physical Android phone is currently available.

Therefore:

`PHYSICAL_ANDROID = NOT VALIDATED`

The existing x86_64 emulator APK is not proof of ARM64 compatibility.

Do not claim store or physical-device release readiness without the necessary evidence.

---

# 13. ENGINEERING HARDENING AND REGRESSION TESTING

Maintain strict engineering standards throughout the redesign.

Required:

- Full relevant Jest suites
- TypeScript checks
- Lint
- Strict OpenSpec
- Game registry validation
- Provenance validation
- Dependency/security audit
- Permission boundary validation
- Offline behavior
- Data migration compatibility
- SQLite integrity
- Backup and restore compatibility
- Clean-checkout certification
- Native Android build
- GitHub Actions

Protect existing:

- User progress
- Session history
- XP and rewards
- Workout state
- Data export/import
- Game registry
- Game identities
- Persistence contracts
- Offline operation

Visual redesigns must not silently introduce data or scoring regressions.

If database changes are necessary, provide safe migrations and regression tests.

Do not weaken tests or acceptance criteria to achieve a green build.

### Dependency discipline

Avoid unnecessary framework-wide dependency upgrades during visual work.

If a dependency change is justified, assess native compatibility, build reproducibility, performance and security.

No unreviewed major upgrades.

---

# 14. IMPLEMENTATION WAVES

Execute as an extended autonomous campaign with durable checkpoints.

The following waves define sequencing, not separate campaigns that require repeated owner approval.

## Wave A — Discovery and independent audit

Complete the source, runtime, visual and game-mechanic audit.

Produce an actionable defect and redesign inventory.

## Wave B — Refero research and art direction

Research real product references, compare candidate visual directions, establish one coherent product language, and identify valuable existing elements to preserve.

## Wave C — ImageGen and asset foundation

Generate, inspect, optimize and integrate the initial asset family.

Build a consistent iconography and illustration system.

## Wave D — Shared design-system reconstruction

Implement tokens, typography, navigation, cards, controls, game stages, motion and reusable presentation primitives.

## Wave E — Primary screen redesign

Rebuild Home, Games, detail/introduction, Progress, Rewards, Profile and supporting screens.

## Wave F — Game presentation and mechanics recovery

Repair discovered gameplay issues and bring all 42 games into the new shared visual language.

Retain mechanic-specific clarity.

## Wave G — Interaction and motion refinement

Improve feedback, responsiveness, transitions, microinteractions and accessibility.

## Wave H — Cross-product convergence

Resolve inconsistencies caused by the separate implementation waves.

Inspect the complete product, not only individual components.

## Wave I — Certification and hardening

Run repository gates, native device checks, clean checkout, final visual review, gameplay regression validation, and ending-SHA CI.

## Wave J — Live owner handoff

Leave the completed application running in a visible Android emulator window, with the updated artwork and interface ready for the owner to inspect.

Do not end after Wave B or Wave C.

The objective is a working redesigned product.

---

# 15. AUTONOMOUS EXECUTION AND TOKEN EFFICIENCY

The owner is assigning a frontier reasoning model for difficult product judgment.

Use that reasoning capacity to make meaningful architectural and design decisions.

Do not waste it on repetitive screenshot commentary or unproductive debate.

### Parallel work

Use parallel subagents for independent research, audits, game-domain analysis and asset inventory.

Use isolated worktrees for independent implementation when beneficial.

Do not make simultaneous uncoordinated edits to shared design-system files.

The lead agent integrates and reviews all work.

### Prioritization

Fix systemic problems before individual instances.

For example:

- If all game HUDs are weak, improve shared HUD components.
- If every page looks generic, redesign the shared visual system.
- If icons are inconsistent, establish a unified icon strategy.
- If assets look amateurish, resolve the art direction before generating more.
- If multiple games mishandle touches, inspect shared interaction components.
- If scores are wrong, fix the relevant scoring contracts before styling the result cards.

Avoid polishing a broken interaction.

### Durable progress

After each meaningful wave, record:

- Work completed
- Real defects fixed
- Assets created
- Tests executed
- Open issues
- Current SHA
- Next actions

Persist checkpoints in the appropriate repository records.

Do not repeatedly declare the entire campaign finished after each wave.

### Long-session discipline

Continue through implementation and validation while the environment permits.

When approaching execution or context limits, produce an exact resumption checkpoint rather than losing decisions or fabricating completion.

Prioritize finishing coherent work over leaving many half-integrated changes.

---

# 16. ACCEPTANCE CRITERIA

Campaign 077 must be evaluated against both engineering and product-quality outcomes.

## Visual

- Coherent, distinctive and appealing art direction.
- Stronger original illustrations where beneficial.
- Consistent functional icons.
- Better typography and hierarchy.
- Clearer, less generic layouts.
- Polished major screens.
- No known high-severity clipping or rendering defects.
- Strong light/dark consistency.
- Responsive layout behavior.
- Purposeful motion.

## Gameplay

- All 42 games inventoried and evaluated.
- Identified mechanic and scoring defects corrected.
- Input interactions verified.
- Shared game presentation coherent.
- Tutorials understandable.
- Honest feedback and results.
- Stable pause/resume.
- No critical persistence regressions.

## Engineering

- Required tests pass.
- Build succeeds.
- Clean-checkout certification passes.
- Provenance is correct.
- No unreviewed critical or high-severity findings.
- Final GitHub Actions pass at the actual ending SHA.

## Owner-visible result

- Android emulator launched with a graphical window.
- Updated app installed and running.
- Original generated assets integrated into the application.
- Home visible at handoff.
- Owner can browse, play and visually assess the redesigned product.

**Passing tests alone is not sufficient.**

The experience must demonstrate meaningful improvements over the previous version.

Do not claim the owner likes the result until the owner personally reviews it.

---

# 17. FINAL REPORT

Provide:

## CAMPAIGN 077 — FRONTIER PRODUCT REBUILD REPORT

**Repository**
- Starting SHA
- Ending SHA
- Commit history
- Worktree state

**Research**
- Refero tools actually used
- References examined
- Lessons adopted
- Selected art direction
- Rejected design directions

**Visual assets**
- ImageGen availability and actual calls
- Original illustrations generated
- Icons replaced or standardized
- Asset manifest
- Optimization results

**UI/UX**
- Screens inspected
- Screens preserved
- Screens refined
- Screens redesigned
- Shared components rebuilt
- Before/after evidence
- Outstanding visual defects

**Games**
- Games assessed out of 42
- Games with confirmed defects
- Defects fixed
- Regression tests added
- Unvalidated states

**Quality**
- Typecheck
- Lint
- Jest
- Clean checkout
- OpenSpec
- Dependency/security
- Android build
- Emulator runtime

**GitHub Actions**
- App CI
- Repository Integrity
- Android Build Smoke
- iOS Build Smoke
- Exact ending SHA and run IDs

**Device handoff**
- Visible GUI status
- AVD and serial
- APK SHA-256
- Package/version
- App foreground state
- Screenshot evidence

**Final assessment**
- Meaningful product improvements
- Known remaining defects
- Owner review still required
- Physical-device and iOS limitations
- Release verdict

Never call a partially implemented redesign complete.

---

# 18. ULTIMATE INSTRUCTION

**The owner did not request another superficial cleanup.**

They rejected the real application after personally using it.

Take that assessment seriously.

Be creatively ambitious but technically disciplined.

Use Refero to discover better interaction and design patterns.

Use ChatGPT ImageGen to produce coherent original artwork rather than relying on generic placeholders.

Examine the entire application for UI glitches, game errors, broken mechanics, poor visual composition, and inconsistent interactions.

Preserve genuinely strong existing elements.

Replace weak ones without hesitation.

Implement the changes, do not merely describe them.

Verify them in the actual Android emulator.

Critique your own work, correct what fails, and iterate toward a cohesive product.

Do not chase green checkboxes at the expense of visual quality.

Do not overdecorate at the expense of cognitive clarity.

Do not confuse generated artwork with good UX.

Do not confuse functional correctness with a desirable product.

**The deliverable is a substantially better Brain Training application—not another report asserting that the old application is good enough.**

Proceed with the full campaign autonomously.