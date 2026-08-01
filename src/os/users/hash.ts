/** djb2 — deterministic and fast, not a real security primitive. Good enough for a simulated /etc/shadow. */
export function hashPassword(password: string): string {
  let hash = 5381
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33) ^ password.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}
