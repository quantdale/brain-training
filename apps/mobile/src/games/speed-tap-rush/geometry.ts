import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';

import type { FieldGeometry, TargetPosition } from './types';

/** The visual circle and hit test share the same platform touch-target floor. */
export function targetDiameter(radius: number, width: number): number {
  return Math.max(MIN_TOUCH_TARGET, 2 * radius * width);
}

export function validFieldGeometry(geometry: FieldGeometry): boolean {
  return geometry != null && Number.isFinite(geometry.width) && geometry.width > 0 &&
    Number.isFinite(geometry.height) && geometry.height > 0;
}

/** Compare in layout dp: a circle remains circular on a nonsquare measured field. */
export function tapHitsTarget(
  x: number,
  y: number,
  target: TargetPosition,
  radius: number,
  geometry: FieldGeometry,
): boolean {
  const dx = (x - target.x) * geometry.width;
  const dy = (y - target.y) * geometry.height;
  const hitRadius = targetDiameter(radius, geometry.width) / 2;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
}
