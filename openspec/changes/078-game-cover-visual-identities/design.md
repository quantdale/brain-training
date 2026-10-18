## Context

See proposal.md. Play Lab uses cool white/navy surfaces, Manrope, eight domain pigments, matte dimensional learning tools, controlled shadows and native titles. Current card art is 112dp high. ID hashes select just three variants of a few board renderers; Spatial and Flexibility include exact collisions. All non-card art reuses domain PNGs.

## Goals / Non-Goals

Goals: mechanic accuracy, distinctive silhouettes at card size, complete deterministic mapping, bounded offline rendering, title-hidden review and real Android proof.

Non-goals: general UI redesign, gameplay, scoring, persistence, historical Campaign076/077 recertification, full gameplay journeys.

## Decisions

- Author precise geometry as deterministic SVG scene fragments. Pre-render static geometry to compact transparent 512×320 PNGs, keeping numbers/words as native overlay text so mathematical/lexical content stays exact. This replaces many mounted miniature board Views with one static Image per cover. Retain authoring sources and checked output inventory.
- Use selected original ImageGen objects where physical material adds meaning, inspect actual output and normalize framing/size before bundling. Do not generate numbers, text or precise puzzle relationships.
- Define exactly one manifest entry per registered ID, including unique concept, domain, local literal require and bounded native label coordinates. Unknown fixtures show no art, never an apparently valid unrelated domain identity.
- Reuse GameWorldArt's public size/test-ID contract with fixed slots, contain fitting, decorative accessibility and pointerEvents none. Keep existing card layout and responsive row fallback.
- Retain domain soft backgrounds in both themes; artwork pigments are stable, with navy text on intentionally pale illustrated paper. No global token change.
- Pilot distinct Memory/Spatial/Language/Speed mechanics before scaling; independent reviewer first interprets numbered covers without titles, then checks interpretations against audited mechanics.

## Risks / Trade-offs

- Closely related memory tasks remain conceptually close → reserve distinct board/console/route/stream compositions and document inherent overlap honestly.
- Raster decoding adds memory → small transparent assets, explicit byte/pixel budget, no source-resolution originals in runtime mapping, before/after native measurements.
- Text must align to rendered geometry → one shared aspect ratio and normalized coordinate system, tested at all supported sizes.
- Emulator noise obscures small timing differences → matched action sequence, retained raw frame/PSS observations, no physical-device FPS claim.

## Migration Plan

Presentation-only replacement; no data migration. Revert the artwork commit to restore previous identity behavior. Install with normal package update and verify existing SQLite history is retained.
