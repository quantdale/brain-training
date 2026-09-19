# Campaign 051 — Fresh Refero Research

Research was performed before implementation despite the existing seed lock.
The references below are inputs, not templates to copy.

## Style searches

Five fresh style searches were run:

1. `playful game console graphic product design bold color blocks tactile controls`
2. `dark technical training lab luminous abstract visual system`
3. `expressive animated learning studio illustration playful product design`
4. `collectible game library storefront bold poster identity`
5. `premium sports training app energetic display typography`

Representative returned styles:

| Reference | ID | Useful signal | Boundary |
| --- | --- | --- | --- |
| Playdate | `c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2` | yellow/charcoal/white graphic blocks, flat surfaces, collectible game imagery, physical controls | adapt the graphic confidence; do not clone the device or palette |
| Active Theory | `9d795615-79d0-4544-ac5e-2858971c3b3b` | void canvas, precise technical type, contained luminous forms, restrained highlight color | use only as a bounded dark/motion reference |
| EVOKE | `1e802d79-598e-4745-aaa5-fa66c16608ad` | billboard clarity, heavy type, stark blocks, zero-gradient poster energy | avoid editorial art direction and decorative noise |
| Peloton | `1b7e4f5c-c3c2-48d5-8f34-3ecdd17f422e` | dark performance credibility, single red CTA, strong studio hierarchy | analytics must remain quieter than play |

Seed locks retained for comparison: Duolingo `9457a848-2905-4fe8-bb58-e168049120cf`,
Quizlet `d6523b05-a53f-4a2a-8829-d65a5c3724e9`, and Stryds
`a3ea1c0a-56f4-4204-876e-9020474f83c4`.

## Screen searches and retrievals

Fresh mobile screen searches covered home/daily workout, discovery/search,
detail/play, tutorial, result celebration, progress analytics, rewards/profile,
and workout progression. Full screens retrieved for direct inspection:

- Brilliant interaction-first lesson `234b08a9-2b30-4b48-a68c-0c1f0deb5994`:
  progress cue, prompt, contained illustration, one full-width solve action.
- Completion result `a1762c65-32e6-49e0-b01b-8d64a845bd7e`: confetti, oversized
  result, compact metrics, one Finish action.
- Progress analytics `40068d7b-6ec0-4df8-8ad5-f7998b6f5234`: dark title/tabs,
  grouped stats and heatmap; useful framing, but not a license for card soup.
- Workout progression `d3d900da-7e17-4aa7-aa76-abb02a614a53`: timer,
  checklist, clear finish/next controls.
- Body Coach detail `211851b8-19b9-4236-af32-a36e3b7b67b7`: centered detail,
  concise steps, dominant PLAY, secondary planned state.
- Apple Games empty state `5dd8a077-f1ae-43ee-a76e-dd4aeddcdcba`: large
  action objects carry interest in a sparse dark state.
- Duolingo completion `aa871eca-62d2-4e49-bbf2-0ce2c16bd879`: illustration,
  bold heading, three metric colors, wide Continue.
- Mindllama collection `ffb91263-59bd-4bea-993b-53bb936ff7ad`: count,
  categories, collectible slots and dark collection framing.

## Flows

- Brilliant progression flow `4316`: lightweight setup → choices →
  recommendations → path → first lesson. Borrow momentum and explicit next
  step, not onboarding scope.
- Apple Games challenge flow `9782`: empty challenges → pick game → configure
  → launch/lobby/active. Borrow storefront-to-play continuity.
- Train Fitness workout flow `7169`: home → timer → completion → summary →
  updated home. Borrow the return loop and completion ownership.

## Decision ledger

| Borrow | Reject |
| --- | --- |
| flat high-contrast blocks, large game objects, tactile controls, sparse empty states, one dominant action, contained progress | warm-beige editorial default, endless white cards, gradient-everything, random neon, glassmorphism, indigo default, badges everywhere, decorative analytics noise |

The synthesis is Signal Arcade: analog-console geometry and domain worlds,
with credible data surfaces and a restrained dark mode.
