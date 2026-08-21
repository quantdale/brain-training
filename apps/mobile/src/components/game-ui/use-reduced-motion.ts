/**
 * usePrefersReducedMotion — shared reduced-motion preference (task 07).
 *
 * Thin re-export: the implementation moved to the shared a11y program
 * (`@/components/a11y/reduced-motion`) so shell surfaces and games subscribe
 * through one hook. Existing imports from this path keep working; new code
 * should import from `@/components/a11y`.
 */
export { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
