/**
 * djb2 — deterministic and fast, not a real security primitive. Used anywhere we need a
 * stable pseudo-random value derived from a string (password digests, fake IPs, fake latency).
 */
export function djb2Hash(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i)
  }
  return hash >>> 0
}
