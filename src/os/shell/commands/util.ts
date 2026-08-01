import type { ShellContext } from '../types'

export function homeOf(ctx: ShellContext): string {
  return ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Applies the shell's current umask (`ctx.env.UMASK`, octal) to a default creation mode. */
export function modeWithUmask(defaultMode: number, ctx: ShellContext): number {
  const umask = parseInt(ctx.env.UMASK ?? '0022', 8)
  return defaultMode & ~umask
}
