/**
 * Game presentation helpers shared by discovery and the detail screen.
 *
 * 071: the `GameCard` COMPONENT that used to live here is removed — it had zero
 * importers after Campaign 032 replaced the grid with `GamePosterTile`, so it
 * was dead weight in the documented kit surface and in the bundle. The module
 * itself stays because these exports are LIVE: `game-detail/[id].tsx`,
 * `game-poster-tile.tsx` and `game-stage.tsx` all import from here, and a plan
 * step that said "delete this file" would have deleted working code.
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { MasteryTier } from '@/mastery';
import { DomainColors, type DomainName } from '@/theme/tokens';

const TIER_LABEL: Record<MasteryTier, string> = {
  unplayed: 'New',
  learning: 'Learning',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced: 'Advanced',
  mastered: 'Mastered',
};

/** Player-facing label for a mastery tier (shared with detail + shelves). */
export function masteryTierLabel(tier: MasteryTier): string {
  return TIER_LABEL[tier];
}

/**
 * Registry category → domain identity key. The registry spells categories
 * `Memory`-style while the palette keys are lowercase, so the lookup folds
 * case instead of assuming they already match.
 *
 * Module-private (D5, audit 2026-10-02): this was exported but had ZERO
 * importers — every consumer carries its own local copy. Kept private so the
 * dead surface cannot drift back into the census.
 */
function domainKeyFor(category: string): DomainName | null {
  const key = category.toLowerCase() as DomainName;
  return key in DomainColors.light ? key : null;
}

/** The four colour slots a surface needs from one domain family. */
export interface DomainHue {
  base: string;
  soft: string;
  softText: string;
  on: string;
}

/**
 * Resolve a domain identity family for the active theme.
 *
 * The v3 token table publishes domain families structurally (`DomainColors`);
 * the flat `Colors` palette may also expose them (`memory`, `memorySoft`, …).
 * Prefer the flat slot when the active theme has it and fall back to the
 * structured family otherwise, so a card can never render an undefined hue
 * while the theme foundation is still landing.
 */
export function useDomainHue(category: string): DomainHue | null {
  const theme = useTheme() as unknown as Record<string, string | undefined>;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const domain = domainKeyFor(category);
  if (!domain) {
    return null;
  }
  const flat: DomainHue = {
    base: theme[domain] ?? '',
    soft: theme[`${domain}Soft`] ?? '',
    softText: theme[`${domain}SoftText`] ?? '',
    on: theme[`${domain}On`] ?? '',
  };
  if (flat.base && flat.soft && flat.softText && flat.on) {
    return flat;
  }
  const family = DomainColors[scheme][domain];
  return { base: family.base, soft: family.soft, softText: family.softText, on: family.on };
}
