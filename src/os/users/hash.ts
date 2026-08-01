import { djb2Hash } from '../hash'

/** Not a real security primitive — this is a simulated OS, not a real auth boundary. */
export function hashPassword(password: string): string {
  return djb2Hash(password).toString(16)
}
