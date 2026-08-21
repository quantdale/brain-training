/**
 * Conflict-policy seam (campaign 010 W20; campaign 009 debt D3).
 *
 * Freezes HOW two devices reconcile divergent copies of one logical record —
 * as descriptors + pure resolvers only. No storage, no network, no clock
 * reads: every input is explicit, so resolution is deterministic and
 * replayable (constitution §6: "deterministically merge local progress").
 *
 * Determinism rules baked into every policy:
 * 1. `updatedAt` is the primary ordering authority.
 * 2. Ties NEVER depend on which device resolves or argument order — the
 *    record with the lexicographically greater `id` wins, identically on
 *    both devices.
 */

import type { SyncDto } from './types';

/* ------------------------------------------------------------------ */
/* Policy descriptors                                                  */
/* ------------------------------------------------------------------ */

/** Whole-row last-write-wins descriptor (`SyncMergeClass` variant). */
export interface LastWriteWinsDescriptor {
  readonly kind: 'last-write-wins';
}

/**
 * Per-field merge rule for `'field-merge'` tables:
 * - `'last-write-wins'` — take the field value from the newer record.
 * - `'max'`             — larger numeric value survives ("preserve valid
 *                         bests", constitution §6).
 * - `'min'`             — smaller numeric value survives (e.g. earliest of
 *                         two timestamps).
 * - `'sum'`             — values add (denormalized counters merged across
 *                         devices).
 */
export type FieldMergeRule = 'last-write-wins' | 'max' | 'min' | 'sum';

/**
 * Field-merge descriptor: maps field names to rules. Fields absent from the
 * map use `defaultRule`. `T` is the concrete DTO type; keys are checked
 * against it so renames break compilation instead of silently mis-merging.
 */
export interface FieldMergeDescriptor<T> {
  readonly kind: 'field-merge';
  readonly fields: { [K in keyof T]?: FieldMergeRule };
  readonly defaultRule: FieldMergeRule;
}

/** Any conflict policy descriptor. */
export type ConflictPolicyDescriptor<T> =
  | LastWriteWinsDescriptor
  | FieldMergeDescriptor<T>;

/* ------------------------------------------------------------------ */
/* Resolution results                                                  */
/* ------------------------------------------------------------------ */

/** How each conflicting field was decided (diagnostics/telemetry seam). */
export interface FieldResolution {
  readonly field: string;
  readonly rule: FieldMergeRule;
  readonly localValue: unknown;
  readonly remoteValue: unknown;
  readonly resolvedValue: unknown;
}

export interface MergeResult<T> {
  /** The reconciled record. Never mutates either input. */
  readonly merged: T;
  /** Only fields where local and remote actually differed. */
  readonly resolutions: readonly FieldResolution[];
}

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Whole-row LWW. Later `updatedAt` wins; an exact tie is broken by the
 * lexicographically greater `id`, which both devices compute identically.
 */
export function resolveLastWriteWins<T extends SyncDto>(local: T, remote: T): T {
  if (local.updatedAt !== remote.updatedAt) {
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  return local.id >= remote.id ? local : remote;
}

/**
 * Apply one field rule. Returns the resolved value plus the rule actually
 * applied — numeric rules fall back to row-level LWW when either side is
 * non-numeric, and diagnostics must show which rule really decided.
 */
function pickByRule(
  rule: FieldMergeRule,
  field: string,
  localValue: unknown,
  remoteValue: unknown,
  winner: SyncDto,
): { value: unknown; effectiveRule: FieldMergeRule } {
  const numeric =
    typeof localValue === 'number' && typeof remoteValue === 'number'
      ? { a: localValue, b: remoteValue }
      : null;

  switch (rule) {
    case 'max':
      if (numeric) return { value: Math.max(numeric.a, numeric.b), effectiveRule: rule };
      break;
    case 'min':
      if (numeric) return { value: Math.min(numeric.a, numeric.b), effectiveRule: rule };
      break;
    case 'sum':
      if (numeric) return { value: numeric.a + numeric.b, effectiveRule: rule };
      break;
    case 'last-write-wins':
      return {
        value: (winner as unknown as Record<string, unknown>)[field],
        effectiveRule: rule,
      };
  }
  // Non-numeric values under a numeric rule follow the row-level LWW
  // winner, keeping resolution device-independent.
  return {
    value: (winner as unknown as Record<string, unknown>)[field],
    effectiveRule: 'last-write-wins',
  };
}

/**
 * Field-level merge. The row-level LWW winner decides `'last-write-wins'`
 * fields and any non-numeric fallbacks. If EITHER side is a tombstone the
 * whole row collapses to the LWW winner — deleted rows have no meaningful
 * fields to merge.
 *
 * Identity fields (`id`) always come from the shared row identity and are
 * never "merged"; `updatedAt` of the result is the max of both sides so the
 * merged record sorts after its inputs in any later LWW comparison.
 */
export function resolveFieldMerge<
  T extends SyncDto & Record<string, unknown>,
>(
  local: T,
  remote: T,
  descriptor: FieldMergeDescriptor<T>,
): MergeResult<T> {
  const winner = resolveLastWriteWins(local, remote);

  // Tombstone short-circuit: deletion propagates as a whole-row decision.
  if (local.deleted || remote.deleted) {
    return { merged: winner, resolutions: [] };
  }

  const merged: Record<string, unknown> = { ...winner };
  const resolutions: FieldResolution[] = [];

  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    const localValue = local[key];
    const remoteValue = remote[key];
    if (localValue === remoteValue) continue;

    const rule =
      key === 'id'
        ? 'last-write-wins'
        : (descriptor.fields[key as keyof T] ?? descriptor.defaultRule);
    const { value: resolvedValue, effectiveRule } = pickByRule(
      rule,
      key,
      localValue,
      remoteValue,
      winner,
    );
    merged[key] = resolvedValue;
    resolutions.push({
      field: key,
      rule: effectiveRule,
      localValue,
      remoteValue,
      resolvedValue,
    });
  }

  // Merged records must not sort BEFORE their inputs in future comparisons.
  merged['updatedAt'] = Math.max(local.updatedAt, remote.updatedAt);
  merged['deleted'] = false;

  return {
    merged: merged as unknown as T,
    resolutions,
  };
}
