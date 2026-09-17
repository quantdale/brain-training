# Campaign 039 isolated dependency refresh

## Scope

The only source-controlled implementation diff in this maintenance slice is:

- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`

The update aligns Expo SDK 57 compatible patch ranges, including Expo
57.0.20 → 57.0.23, Audio 57.0.4 → 57.0.5, Document Picker 57.0.1 → 57.0.2,
Haptics 57.0.2 → 57.0.3, Linking 57.0.9 → 57.0.10, Router 57.0.19 →
57.0.21, Sharing 57.0.18 → 57.0.20, Splash Screen 57.0.8 → 57.0.9, SQLite
57.0.2 → 57.0.3, and Symbols 57.0.2 → 57.0.3. Compatible patch resolutions
also brought Asset 57.0.17, Constants 57.0.18, File System 57.0.7, and Font
57.0.4 into the installed tree while their existing `~57.0.x` manifest ranges
remained valid.

## Evidence

Before the change, `npx expo-doctor` was 20/21 with 14 patch mismatches. After
`npx expo install --fix`, it was 21/21. `npm ls --depth=0` resolved the
expected compatible versions. The refreshed tree passed the repository
dependency-audit, provenance, offline, secrets, and workflow validators.

The refreshed tree also passed the full Jest suite, TypeScript, lint, OpenSpec,
registry, affected-path, and runtime-QA gates. Both debug and release Android
builds passed, and the release matrix was route-verified/nonblank 22/22 with
zero automated accessibility violations.

This is an isolated maintenance commit. No CI workflow was edited, and no
generic npm vulnerability output was relabelled as clean: npm printed 20
findings, while the repository validator accepted the five already-tracked
advisories under `.agent/DEPENDENCY_AUDIT.md`.
