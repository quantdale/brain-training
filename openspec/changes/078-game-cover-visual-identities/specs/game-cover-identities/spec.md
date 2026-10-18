## Purpose

Help players recognize each registered activity from its cover while retaining Brain Training's coherent Play Lab visual identity and offline operation.

## ADDED Requirements

### Requirement: Complete mechanic-specific identity
Every registered game SHALL have one intentional primary cover keyed by stable game ID. Its main subject and action SHALL accurately reflect implemented gameplay, and same-domain siblings SHALL differ by meaning and composition beyond color.

#### Scenario: Browse the complete catalog without titles
- **WHEN** the 42 game covers are shown without game names
- **THEN** every registered ID has its intended cover, with no accidental duplicate or silent domain fallback, and an independent mechanic-based review records ambiguity and revisions

### Requirement: Consistent offline presentation
The cover SHALL remain locally available offline and visually consistent in library, detail and introduction surfaces. It SHALL preserve aspect ratio, fixed layout space, touch targets, labels and existing route behavior in both themes and supported responsive profiles.

#### Scenario: Open and return offline
- **WHEN** a player browses offline and opens a card then returns to Games
- **THEN** the intended artwork renders without remote loading, clipping or layout shift and the original route, title, favorite and progress behavior remains available

### Requirement: Bounded rendering cost
Cover artwork SHALL use appropriately sized assets or bounded native geometry without animated backgrounds, runtime blur or unnecessary image decoding. Validation SHALL compare asset/bundle budgets and repeatable emulator frame and memory observations against the prior implementation.

#### Scenario: Scroll the revised collection
- **WHEN** the full collection is scrolled in the same measured emulator environment before and after implementation
- **THEN** asset loading, frame behavior and memory are recorded with environmental limitations and avoidable regressions are repaired
