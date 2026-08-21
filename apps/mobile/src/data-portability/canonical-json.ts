/**
 * Deterministic (canonical) JSON serialization.
 *
 * Backup integrity depends on byte-for-byte stable serialization: the same
 * logical data must always produce the same string so its checksum is
 * reproducible. We sort object keys recursively (arrays keep their order, which
 * we control at snapshot-build time by sorting element arrays). The output of
 * `canonicalString` is what the checksum is computed over.
 *
 * Campaign 010 (debt D2): the writer below produces that same canonical text in
 * a SINGLE pass — no intermediate deep copy, one stringification. The legacy
 * pipeline (`canonicalize` deep copy + one big `JSON.stringify`) is preserved
 * as `canonicalize` because tests and external tooling rely on its deep-copy
 * semantics, but nothing on the hot path uses it anymore.
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

/**
 * Stream the canonical JSON text of `value` through `emit`, chunk by chunk.
 *
 * Byte-for-byte identical to `JSON.stringify(canonicalize(value))` — including
 * its edge semantics: `undefined`/function/symbol members are omitted from
 * objects and become `null` inside arrays, non-finite numbers become `null`,
 * exotic objects (Date via `toJSON`, wrappers, Map/Set/RegExp) delegate to
 * `JSON.stringify` exactly like the legacy canonicalize-then-stringify
 * pipeline, and BigInt throws.
 *
 * This is the memory-conscious primitive: callers can hash chunks as they are
 * produced (see `Sha256`) instead of materializing a second full-size copy of
 * the payload.
 */
export function writeCanonicalJson(
  value: unknown,
  emit: (chunk: string) => void,
): void {
  writeValue(value, emit);
}

function writeValue(value: unknown, emit: (chunk: string) => void): void {
  switch (typeof value) {
    case 'string':
      // Native escaper: exact JSON escaping parity at C++ speed.
      emit(JSON.stringify(value));
      return;
    case 'number':
      // Number::toString matches JSON.stringify for every finite number
      // (including -0 → "0"); non-finite values serialize as null.
      emit(Number.isFinite(value) ? String(value) : 'null');
      return;
    case 'boolean':
      emit(value ? 'true' : 'false');
      return;
    case 'undefined':
    case 'function':
    case 'symbol':
      // Array elements / top level: JSON.stringify renders these as null.
      // Object members carrying such values must be skipped by the caller.
      emit('null');
      return;
    case 'bigint':
      throw new TypeError('canonical JSON cannot serialize BigInt values');
    case 'object': {
      if (value === null) {
        emit('null');
        return;
      }
      const toJSON = (value as { toJSON?: unknown }).toJSON;
      if (typeof toJSON === 'function') {
        writeValue((toJSON as (this: unknown) => unknown).call(value), emit);
        return;
      }
      if (Array.isArray(value)) {
        emit('[');
        for (let i = 0; i < value.length; i++) {
          if (i > 0) emit(',');
          // Sparse holes read as undefined → "null", matching JSON.stringify.
          writeValue(value[i], emit);
        }
        emit(']');
        return;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        // Exotic object (Number/String/Boolean wrappers, Map, Set, RegExp…):
        // the legacy pipeline passed these through canonicalize untouched and
        // let JSON.stringify render them — delegate so bytes stay identical.
        emit(JSON.stringify(value));
        return;
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      // Default sort = UTF-16 code-unit order, identical to legacy `.sort()`.
      keys.sort();
      emit('{');
      let first = true;
      for (const key of keys) {
        const v = obj[key];
        if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
          continue; // JSON.stringify omits these members entirely.
        }
        if (!first) emit(',');
        first = false;
        emit(JSON.stringify(key));
        emit(':');
        writeValue(v, emit);
      }
      emit('}');
      return;
    }
  }
}

/** Canonical text of `value` as an array of chunks (joined === canonical text). */
export function canonicalChunks(value: unknown): string[] {
  const chunks: string[] = [];
  writeCanonicalJson(value, (chunk) => chunks.push(chunk));
  return chunks;
}

/** Stable JSON string with recursively sorted object keys (no whitespace). */
export function canonicalString(value: unknown): string {
  return canonicalChunks(value).join('');
}
