# Campaign 051 — Design System Rebuild

## Signal Arcade token commitments

| Layer | Rebuild | Contract |
| --- | --- | --- |
| Canvas | warm paper light / blue-black instrument dark | `Colors.background`, `surface`, `surfaceSunken` |
| Action | signal coral with readable ink/white pairings | `Families.accent`, `Button` |
| World pigments | cyan, yellow, mint, violet plus domain family bases | `ArcadePalette`, `DomainColors` |
| Geometry | block, soft, poster shape roles; smaller corner scale | `CardShape`, `Radii`, `Card` |
| Depth | flat default, reserved raised/hero shadow, tactile button lip | `Elevation`, `Depth`, `Button` |
| Type | heavier display/title hierarchy, compact eyebrow tracking | `Typography`, `ThemedText` |
| Motion | quick key response, bounded entrance/celebration, reduced-motion collapse | `Motion`, `Springs`, `Tappable` |
| Responsive | existing compact/medium/expanded gutters and safe-area contract | `ScreenShell`, `SectionGrid`, `NativeTabs` |

## Implementation notes

- Existing semantic color keys remain intact so data/state components do not
  lose their contrast or meaning.
- `Card` now separates role (`plain`, `outlined`, `raised`, `hero`) from
  geometry (`block`, `soft`, `poster`). Plain cards are flat by default; a
  poster card adds a deliberate boundary for game-world objects.
- Buttons are block-shaped physical keys; `Badge` and discovery `Chip` remain
  pill-shaped because they represent filters/status, not containers.
- `GameWorldArt` uses only bounded React Native Views and the existing theme;
  it introduces no image dependency or runtime network path.
- The contrast audit remains authoritative and currently passes all semantic
  and domain pairings in both schemes.
