# Task Packet 001-a — App Shell and Navigation (WP-A)

Campaign: 001-autonomous-foundation
Status: READY
Owner role: coder agent

## Objective

Customize the scaffolded Expo app into the four-tab shell: Home, Games, Progress, Profile/More. Establish the design-token foundation and provisional app identity. Replace all template placeholder screens with real (but simple) first versions:

- Home: placeholder dashboard with Today's Workout CTA slot, streak/XP/level slot, recent games slot (static placeholder data only; no persistence wiring).
- Games: static game library grid rendering the generated game registry (empty state until games register).
- Progress: static placeholder summary.
- Profile/More: static placeholder with settings toggles (SFX/music/haptics on/off) stored via a simple in-memory or AsyncStorage-backed hook — no SQLite.

## Dependencies

- Orchestrator scaffold commit (Expo SDK 57 template with jest-expo configured).

## Allowed write surfaces

- `apps/mobile/app/**` (expo-router routes, including the dynamic `app/game/[id].tsx` route that renders a game by id from the generated registry).
- `apps/mobile/src/theme/**` (design tokens: colors, spacing, typography, radii).
- `apps/mobile/components/**` and `apps/mobile/constants/**`.
- `apps/mobile/assets/**` (only app icon/splash/branding adjustments for provisional identity).
- `apps/mobile/src/registry/**` — only the *consumer* type of the generated registry (`registry.generated.ts` is orchestrator-owned; do not create it).
- Test files colocated under the surfaces above.

## Forbidden / shared write surfaces

- `package.json`, `package-lock.json` (report any dependency need to the orchestrator).
- `apps/mobile/src/db/**`, `apps/mobile/src/sdk/**`, `apps/mobile/src/games/**`.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Four tabs exist with stable semantic testIDs: `tab-home`, `tab-games`, `tab-progress`, `tab-profile`.
- Design tokens file with documented palette/spacing/typography scale; no hardcoded magic colors in the shell.
- `app/game/[id].tsx` resolves a game from the registry and renders a NotReady fallback when absent.
- Template demo code (parallax, hello wave, etc.) removed or converted to real shell content.
- `npx tsc --noEmit` passes in `apps/mobile`.

## Cheap validation

- `npx tsc --noEmit`
- `npm test` (jest) with at least one smoke test for the tab shell

## Integration notes for orchestrator

- Agent must NOT generate the registry file; it may reference `src/registry/registry.generated.ts` types if the SDK agent's `GameDefinition` is available; otherwise use a local placeholder type and note it.
- Report any new dependencies (e.g. vector icons beyond template, haptics package) for orchestrator install.

## Result/evidence

(agent fills in)
