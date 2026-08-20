/**
 * Deterministic (canonical) JSON serialization.
 *
 * Backup integrity depends on byte-for-byte stable serialization: the same
 * logical data must always produce the same string so its checksum is
 * reproducible. We sort object keys recursively (arrays keep their order, which
 * we control at snapshot-build time by sorting element arrays). The output of
 * `canonicalString` is what the checksum is computed over.
 */

/** Return a deep copy of `value` with all object keys recursively sorted. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** Stable JSON string with recursively sorted object keys (no whitespace). */
export function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
