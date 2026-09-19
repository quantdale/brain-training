/**
 * Root-layout route-tree fixtures for tests that render the REAL RootLayout
 * (Campaign 053, task 3.4).
 *
 * `RootLayout`'s navigator declares ten `Stack.Screen` names. expo-router warns
 * for every declared name that is absent from the rendered route tree
 * (`No route named "..." exists in nested children`), which used to make these
 * tests emit framework noise unrelated to the behavior under test. Providing
 * the complete declared set keeps the tree honest — the real navigator still
 * mounts and resolves — without suppressing anything.
 */
import type { ComponentType } from 'react';

/**
 * Every route name declared by the production root `Stack`. Group routes need
 * a child file, so `(tabs)` is represented as `(tabs)/index`.
 */
export const ROOT_LAYOUT_ROUTE_NAMES = [
  '(tabs)/index',
  'game/[id]',
  'game-detail/[id]',
  'results',
  'progress-detail',
  'progress-activity',
  'progress-domain',
  'progress-game',
  'rewards',
  'data-management',
] as const;

/**
 * Build a route map containing every declared root route. `overrides` replace
 * specific routes with the test's probe component; every other declared route
 * renders an empty stub so the navigator has no missing children.
 */
export function rootLayoutRoutes(
  overrides: Record<string, ComponentType>,
): Record<string, ComponentType> {
  const routes: Record<string, ComponentType> = {};
  for (const name of ROOT_LAYOUT_ROUTE_NAMES) {
    routes[name] = () => null;
  }
  return { ...routes, ...overrides };
}
