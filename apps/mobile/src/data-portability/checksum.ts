/**
 * Pure-TypeScript SHA-256 (FIPS 180-4).
 *
 * No dependencies and no native module, so the exact same digest is produced
 * in Node (tests) and React Native (app). That portability is essential: a
 * backup's checksum must validate identically on every platform that reads it.
 *
 * This is an *integrity* checksum (accidental corruption / truncation /
 * tampering detection), not a cryptographic MAC — the constitution defers
 * password-encrypted backups, so confidentiality is out of scope here.
 *
 * Campaign 010 (debt D2): `Sha256` exposes incremental `update()` so large
 * backups can be hashed WHILE they are serialized chunk-by-chunk, instead of
 * materializing the whole payload string plus a second full-size UTF-8 byte
 * copy. Digests are identical whether fed in one call or many.
 */

import { writeCanonicalJson } from './canonical-json';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * Encode a JS string as UTF-8.
 *
 * Two-pass (count bytes, then fill) so multi-megabyte payloads never build the
 * intermediate boxed `number[]` the legacy encoder allocated. Byte output is
 * IDENTICAL to the legacy encoder, including its deterministic handling of a
 * trailing lone high surrogate (it consumes the next code unit unconditionally;
 * a missing/invalid continuation yields the same fixed byte sequence).
 */
export function utf8Encode(input: string): Uint8Array {
  let byteLength = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      byteLength += 1;
    } else if (code < 0x800) {
      byteLength += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair: combine with the next code unit.
      byteLength += 4;
      i++;
    } else {
      byteLength += 3;
    }
  }

  const out = new Uint8Array(byteLength);
  let j = 0;
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      out[j++] = code;
    } else if (code < 0x800) {
      out[j++] = 0xc0 | (code >> 6);
      out[j++] = 0x80 | (code & 0x3f);
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(++i);
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      out[j++] = 0xf0 | (code >> 18);
      out[j++] = 0x80 | ((code >> 12) & 0x3f);
      out[j++] = 0x80 | ((code >> 6) & 0x3f);
      out[j++] = 0x80 | (code & 0x3f);
    } else {
      out[j++] = 0xe0 | (code >> 12);
      out[j++] = 0x80 | ((code >> 6) & 0x3f);
      out[j++] = 0x80 | (code & 0x3f);
    }
  }
  return out;
}

/** Right-rotate a 32-bit integer `n` bits. */
function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

const BLOCK_SIZE = 64;

/**
 * Incremental SHA-256. Feed arbitrarily sized string/byte chunks via `update`,
 * then read the hex digest once via `digestHex`. Chunk boundaries never affect
 * the digest: partial blocks are carried internally.
 *
 * `digestHex` is non-destructive (padding runs against a snapshot of the
 * chaining state), though the intended usage is exactly one digest per hash.
 */
export class Sha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly w = new Uint32Array(64);
  private readonly carry = new Uint8Array(BLOCK_SIZE);
  private buffered = 0;
  private totalBytes = 0;

  /** Absorb one more chunk of message bytes. */
  update(data: string | Uint8Array): this {
    const bytes = typeof data === 'string' ? utf8Encode(data) : data;
    this.totalBytes += bytes.length;

    let offset = 0;
    if (this.buffered > 0) {
      const take = Math.min(BLOCK_SIZE - this.buffered, bytes.length);
      this.carry.set(bytes.subarray(0, take), this.buffered);
      this.buffered += take;
      offset = take;
      if (this.buffered === BLOCK_SIZE) {
        this.processBlock(this.carry, 0);
        this.buffered = 0;
      }
    }
    while (offset + BLOCK_SIZE <= bytes.length) {
      this.processBlock(bytes, offset);
      offset += BLOCK_SIZE;
    }
    if (offset < bytes.length) {
      this.carry.set(bytes.subarray(offset), 0);
      this.buffered = bytes.length - offset;
    }
    return this;
  }

  /** Finalize and return the lowercase hex digest. */
  digestHex(): string {
    // Snapshot the chaining state so digesting stays non-destructive.
    const saved = this.state.slice();

    // Pre-processing: append the bit '1', zeros, then the 64-bit length.
    const rem = this.buffered;
    const finalLen = rem + 9 <= BLOCK_SIZE ? BLOCK_SIZE : BLOCK_SIZE * 2;
    const final = new Uint8Array(finalLen);
    final.set(this.carry.subarray(0, rem));
    final[rem] = 0x80;
    const bitLength = this.totalBytes * 8; // safe: payloads stay far below 2^53 bits
    const view = new DataView(final.buffer);
    view.setUint32(finalLen - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(finalLen - 4, bitLength >>> 0);

    this.processBlock(final, 0);
    if (finalLen === BLOCK_SIZE * 2) {
      this.processBlock(final, BLOCK_SIZE);
    }

    const hex = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => toHex(this.state[i])).join('');
    this.state.set(saved);
    return hex;
  }

  /** Compress one 64-byte block starting at `offset` into the chaining state. */
  private processBlock(bytes: Uint8Array, offset: number): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BLOCK_SIZE);
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = this.state[0];
    let b = this.state[1];
    let c = this.state[2];
    let d = this.state[3];
    let e = this.state[4];
    let f = this.state[5];
    let g = this.state[6];
    let h = this.state[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.state[0] = (this.state[0] + a) | 0;
    this.state[1] = (this.state[1] + b) | 0;
    this.state[2] = (this.state[2] + c) | 0;
    this.state[3] = (this.state[3] + d) | 0;
    this.state[4] = (this.state[4] + e) | 0;
    this.state[5] = (this.state[5] + f) | 0;
    this.state[6] = (this.state[6] + g) | 0;
    this.state[7] = (this.state[7] + h) | 0;
  }
}

/** Convert a 32-bit integer to an 8-char lowercase hex string. */
function toHex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compute the SHA-256 digest of a UTF-8 string and return it as a lowercase
 * hex string. Deterministic across platforms.
 */
export function sha256Hex(message: string): string {
  return new Sha256().update(message).digestHex();
}

/**
 * Checksum provider used by the backup envelope. The algorithm is fixed to a
 * pure-SHA-256 so every writer and reader agrees. `label` is stored in the
 * envelope's `checksumAlgorithm` field for forward-diagnosability.
 */
export const CHECKSUM_ALGORITHM = 'sha256';

/** Compute the envelope checksum over the canonical (checksum-excluded) payload. */
export function computeChecksum(payload: string): string {
  return sha256Hex(payload);
}

/**
 * SHA-256 over the canonical JSON form of `value`, computed in ONE pass:
 * canonical chunks stream straight into the hasher, so verification never
 * materializes the joined canonical string nor a second full-size UTF-8 copy.
 * Digest is identical to `computeChecksum(canonicalString(value))`.
 */
export function canonicalSha256Hex(value: unknown): string {
  const hasher = new Sha256();
  writeCanonicalJson(value, (chunk) => hasher.update(chunk));
  return hasher.digestHex();
}