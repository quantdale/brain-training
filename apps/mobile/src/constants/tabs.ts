/**
 * Tab model — single source of truth for the four bottom tabs.
 *
 * Both the native tab bar (`src/components/app-tabs.tsx`, NativeTabs) and the
 * web tab bar (`src/components/app-tabs.web.tsx`, expo-router/ui Tabs) render
 * from this list, so labels, icons and semantic testIDs stay in sync.
 *
 * testIDs are the stable QA contract (see PROJECT_CONSTITUTION §29):
 * - native: `testID` maps to the native tab item's view tag / a11y identifier
 * - web: `testID` lands on the tab button element
 *
 * `name` must match the expo-router route name in `src/app/` (including the
 * special `index` route), `href` the web-route path.
 */
import type { AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface TabDefinition {
  /** expo-router route name (file name under src/app). */
  name: 'index' | 'games' | 'progress' | 'profile';
  /** Visible tab label. */
  label: string;
  /** Stable semantic testID: `tab-<name>`. */
  testID: string;
  /** iOS SF Symbol (native tabs). */
  sf: SFSymbol;
  /** Android Material symbol (native tabs, rendered via expo-symbols). */
  md: AndroidSymbol;
  /** Web SymbolView name (Material symbol set). */
  web: AndroidSymbol;
  /** Web route href. */
  href: '/' | '/games' | '/progress' | '/profile';
}

export const TAB_DEFINITIONS: readonly TabDefinition[] = [
  {
    name: 'index',
    label: 'Home',
    testID: 'tab-home',
    sf: 'house.fill',
    md: 'home',
    web: 'home',
    href: '/',
  },
  {
    name: 'games',
    label: 'Games',
    testID: 'tab-games',
    sf: 'gamecontroller.fill',
    md: 'sports_esports',
    web: 'sports_esports',
    href: '/games',
  },
  {
    name: 'progress',
    label: 'Progress',
    testID: 'tab-progress',
    sf: 'chart.bar.fill',
    md: 'bar_chart',
    web: 'bar_chart',
    href: '/progress',
  },
  {
    name: 'profile',
    label: 'Profile',
    testID: 'tab-profile',
    sf: 'person.fill',
    md: 'person',
    web: 'person',
    href: '/profile',
  },
] as const;
