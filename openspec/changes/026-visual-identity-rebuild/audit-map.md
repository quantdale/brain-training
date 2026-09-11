# Audit map — Campaign 026: Visual Identity Rebuild

Baseline SHA `6f420cc` (Campaign 025 closed VALIDATED).

## Baseline inventory (what exists today)

- **Identity:** "calm blue-indigo on near-white" (Campaign 024 tokens): system
  blue accent, white surfaces, equal-radius white cards, tint-only tab active
  state, thin unlabelled progress bars, streak as a text row.
- **Change surface (high leverage):**
  - `apps/mobile/src/theme/tokens.ts` — palettes, semantic families, domain
    colours, metric colours, typography, radii, elevation, motion.
  - `apps/mobile/src/components/ui/**` — the kit (23 primitives).
  - `apps/mobile/src/components/screen-shell.tsx`, `app-tabs.tsx`,
    `components/shell/**` — app chrome.
  - `apps/mobile/src/components/game-host/**`,
    `components/game-ui/**` — shared game chrome.
  - 16 routes under `apps/mobile/src/app/**`.
  - 42 game boards under `apps/mobile/src/games/**` (presentation files only;
    Campaign 025 verdict semantics already shipped).
- **Native baseline:** `qa-artifacts/campaign026/before/**` (emulator-5560,
  light/dark, default profile) — the frames the owner compares against.

## What the redesign replaces (owner's anti-pattern list)

| Today | Target |
|---|---|
| Equal-weight white card stacks | One hero + one primary action per screen; quieter rows |
| No hero metric | Hero metric inside/next to a progress visual |
| Thin unlabelled bars | Labelled charts with zero states and identity colours |
| Streak as a text row | Day-dot strip + count pill |
| One treatment for claimable/in-progress/locked | Three visually distinct treatments |
| Generic empty states | Designed empty states (mark, headline, line, CTA) |
| Tint-only tab active state | Filled lozenge active state |
| Decorative colour | Eight domain identities + metric hues with fixed meaning |
| Verdict by text colour | Campaign 025 fill+border+glyph language, re-skinned |

## Per-surface disposition

- Shell/tabs/screen-shell: rebuild on new tokens + kit (orchestrator).
- Kit: restyle all primitives, add hero/spark/confetti/streak marks
  (orchestrator).
- Home/library, progress suite, profile/rewards/data, results/workout:
  parallel surface packets (P1–P4), each preserving every testID.
- Game chrome: orchestrator restyle of intro/HUD/results; boards inherit the
  new tokens; board-local literal sweeps handled by the orchestrator after
  the kit lands.
- Evidence: post-redesign captures mirror the baseline set; a11y audit,
  canaries, workout journey, matrix, validators.

## Explicit NOT-in-scope

Mechanics, scoring, generators, difficulty, persistence, sync, data
portability, analytics, SDK contract, new native dependencies, iOS runtime,
store signing, manual TalkBack review.
