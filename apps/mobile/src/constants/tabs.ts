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
import type { AppIconName } from '@/components/ui/app-icon';

export interface TabDefinition {
  /** expo-router route name (file name under src/app). */
  name: 'index' | 'games' | 'progress' | 'profile';
  /** Visible tab label. */
  label: string;
  /** Stable semantic testID: `tab-<name>`. */
  testID: string;
  /** Shared Lucide vocabulary on Android, iOS and web. */
  icon: AppIconName;
  /** Web route href. */
  href: '/' | '/games' | '/progress' | '/profile';
}

export const TAB_DEFINITIONS: readonly TabDefinition[] = [
  {
    name: 'index',
    label: 'Home',
    testID: 'tab-home',
    icon: 'home',
    href: '/',
  },
  {
    name: 'games',
    label: 'Games',
    testID: 'tab-games',
    icon: 'games',
    href: '/games',
  },
  {
    name: 'progress',
    label: 'Progress',
    testID: 'tab-progress',
    icon: 'progress',
    href: '/progress',
  },
  {
    name: 'profile',
    label: 'Profile',
    testID: 'tab-profile',
    icon: 'profile',
    href: '/profile',
  },
] as const;
